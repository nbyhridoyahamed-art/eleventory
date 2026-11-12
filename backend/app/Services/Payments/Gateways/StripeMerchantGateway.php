<?php

namespace App\Services\Payments\Gateways;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\StorePaymentGateway;
use App\Services\Payments\GatewayPayment;
use App\Services\Payments\MerchantGateway;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * The store's own Stripe account, via hosted Checkout. Test mode needs test keys and live mode
 * live keys; mixing them is refused when the keys are saved. A payment is only ever confirmed by
 * a webhook whose signature verifies against the store's own signing secret.
 */
class StripeMerchantGateway implements MerchantGateway
{
    private const API = 'https://api.stripe.com/v1';

    private const TOLERANCE_SECONDS = 300;

    public function key(): string
    {
        return 'stripe';
    }

    public function label(): string
    {
        return 'Stripe';
    }

    public function description(): string
    {
        return 'International cards through your own Stripe account (Stripe Checkout).';
    }

    public function credentialFields(): array
    {
        return [
            ['key' => 'secret_key', 'label' => 'Secret key', 'secret' => true],
            ['key' => 'webhook_secret', 'label' => 'Webhook signing secret', 'secret' => true],
        ];
    }

    public function credentialProblem(array $credentials, bool $testMode): ?string
    {
        $secret = trim((string) ($credentials['secret_key'] ?? ''));
        $hook = trim((string) ($credentials['webhook_secret'] ?? ''));

        if ($secret === '' || $hook === '') {
            return 'Enter both the secret key and the webhook signing secret from your Stripe dashboard.';
        }

        $prefix = $testMode ? ['sk_test_', 'rk_test_'] : ['sk_live_', 'rk_live_'];

        if (! collect($prefix)->contains(fn ($p) => str_starts_with($secret, $p))) {
            return $testMode ? 'Test mode needs a test key (it starts with sk_test_).' : 'Live mode needs a live key (it starts with sk_live_). Switch on test mode to use a test key.';
        }

        if (! str_starts_with($hook, 'whsec_')) {
            return 'The webhook signing secret starts with whsec_.';
        }

        return null;
    }

    public function startCheckout(StorePaymentGateway $account, PaymentAttempt $attempt, Order $order, array $urls): string
    {
        $response = Http::withToken($account->credential('secret_key'))->asForm()->timeout(20)->post(self::API.'/checkout/sessions', [
            'mode' => 'payment',
            'client_reference_id' => $attempt->tran_id,
            'success_url' => $urls['success'],
            'cancel_url' => $urls['cancel'],
            'line_items' => [[
                'quantity' => 1,
                'price_data' => [
                    'currency' => strtolower($attempt->currency_code),
                    'unit_amount' => $attempt->amount_minor,
                    'product_data' => ['name' => 'Order '.$order->order_number],
                ],
            ]],
            'metadata' => ['tran_id' => $attempt->tran_id, 'order' => $order->order_number],
        ]);

        if (! $response->ok() || ! $response->json('url')) {
            Log::warning('payments.stripe.session_failed', ['order' => $order->order_number, 'error' => $response->json('error.message')]);

            throw new RuntimeException('The payment page could not be opened. Please try again or choose another method.');
        }

        return (string) $response->json('url');
    }

    public function confirm(StorePaymentGateway $account, array $payload, string $rawBody = '', array $headers = []): ?GatewayPayment
    {
        if (! $this->signatureValid($rawBody, (string) ($headers['stripe-signature'] ?? ''), $account->credential('webhook_secret'))) {
            return null;
        }

        $type = (string) ($payload['type'] ?? '');
        $object = $payload['data']['object'] ?? [];

        if (! in_array($type, ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed'], true)) {
            return null;
        }

        $tranId = (string) ($object['client_reference_id'] ?? ($object['metadata']['tran_id'] ?? ''));

        if ($tranId === '') {
            return null;
        }

        return new GatewayPayment(
            $tranId,
            $type !== 'checkout.session.async_payment_failed' && ($object['payment_status'] ?? '') === 'paid',
            (int) ($object['amount_total'] ?? 0),
            strtoupper((string) ($object['currency'] ?? '')),
            (string) ($object['payment_intent'] ?? ''),
            ['event' => $payload['id'] ?? null, 'payment_intent' => $object['payment_intent'] ?? null],
        );
    }

    public function refund(StorePaymentGateway $account, PaymentAttempt $attempt, int $amountMinor, string $reason): string
    {
        $intent = (string) ($attempt->gateway_payload['payment_intent'] ?? $attempt->provider_reference);

        $response = Http::withToken($account->credential('secret_key'))->asForm()->timeout(20)->post(self::API.'/refunds', [
            'payment_intent' => $intent,
            'amount' => $amountMinor,
            'metadata' => ['tran_id' => $attempt->tran_id, 'reason' => mb_substr($reason, 0, 200)],
        ]);

        if (! $response->ok() || ! $response->json('id')) {
            Log::warning('payments.stripe.refund_failed', ['attempt' => $attempt->id, 'error' => $response->json('error.message')]);

            throw new RuntimeException('Stripe did not accept the refund: '.($response->json('error.message') ?: 'unknown reason').'.');
        }

        return (string) $response->json('id');
    }

    /** Stripe's scheme: header "t=<unix>,v1=<hmac>", hmac = HMAC-SHA256("<t>.<body>", secret). */
    private function signatureValid(string $body, string $header, string $secret): bool
    {
        if ($body === '' || $header === '' || $secret === '') {
            return false;
        }

        $timestamp = null;
        $signatures = [];

        foreach (explode(',', $header) as $part) {
            [$k, $v] = array_pad(explode('=', trim($part), 2), 2, '');
            if ($k === 't') {
                $timestamp = (int) $v;
            } elseif ($k === 'v1') {
                $signatures[] = $v;
            }
        }

        if (! $timestamp || abs(time() - $timestamp) > self::TOLERANCE_SECONDS) {
            return false;
        }

        $expected = hash_hmac('sha256', $timestamp.'.'.$body, $secret);

        return collect($signatures)->contains(fn ($sig) => hash_equals($expected, $sig));
    }
}
