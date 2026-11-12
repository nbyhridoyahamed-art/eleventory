<?php

namespace App\Services\Payments\Gateways;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\StorePaymentGateway;
use App\Services\Payments\GatewayPayment;
use App\Services\Payments\MerchantGateway;
use App\Support\Money;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * The store's own SSLCommerz account (cards, bKash, Nagad, banks). Test mode uses the sandbox,
 * which has its own store id/password. The browser return and the IPN are never trusted on
 * their own: confirm() asks SSLCommerz's validation API whether `val_id` is a real payment.
 */
class SslCommerzMerchantGateway implements MerchantGateway
{
    public function key(): string
    {
        return 'sslcommerz';
    }

    public function label(): string
    {
        return 'SSLCommerz';
    }

    public function description(): string
    {
        return 'Cards, bKash, Nagad, Rocket and bank payments through your own SSLCommerz account.';
    }

    public function credentialFields(): array
    {
        return [
            ['key' => 'store_id', 'label' => 'Store ID', 'secret' => false],
            ['key' => 'store_password', 'label' => 'Store password', 'secret' => true],
        ];
    }

    public function credentialProblem(array $credentials, bool $testMode): ?string
    {
        if (trim((string) ($credentials['store_id'] ?? '')) === '' || trim((string) ($credentials['store_password'] ?? '')) === '') {
            return 'Enter both the Store ID and the Store password from your SSLCommerz account.';
        }

        return null;
    }

    public function startCheckout(StorePaymentGateway $account, PaymentAttempt $attempt, Order $order, array $urls): string
    {
        $order->loadMissing('customer');
        $customer = $order->customer;

        $response = Http::asForm()->timeout(20)->post($this->base($account).'/gwprocess/v4/api.php', [
            'store_id' => $account->credential('store_id'),
            'store_passwd' => $account->credential('store_password'),
            'total_amount' => number_format((new Money($attempt->amount_minor, $attempt->currency_code))->toDecimal(), 2, '.', ''),
            'currency' => $attempt->currency_code,
            'tran_id' => $attempt->tran_id,
            'success_url' => $urls['success'],
            'fail_url' => $urls['fail'],
            'cancel_url' => $urls['cancel'],
            'ipn_url' => $urls['ipn'],
            'cus_name' => $customer?->name ?: 'Customer',
            'cus_email' => $customer?->email ?: 'customer@example.com',
            'cus_phone' => $customer?->phone ?: $order->shipping_phone,
            'cus_add1' => (string) $order->shipping_address_line,
            'cus_city' => 'Dhaka',
            'cus_country' => 'Bangladesh',
            'shipping_method' => 'Courier',
            'ship_name' => $order->shipping_recipient_name,
            'ship_add1' => (string) $order->shipping_address_line,
            'ship_city' => 'Dhaka',
            'ship_postcode' => '1000',
            'ship_country' => 'Bangladesh',
            'product_name' => 'Order '.$order->order_number,
            'product_category' => 'Goods',
            'product_profile' => 'physical-goods',
        ]);

        $url = $response->json('GatewayPageURL');

        if (! $response->ok() || $response->json('status') !== 'SUCCESS' || ! $url) {
            Log::warning('payments.sslcommerz.session_failed', ['order' => $order->order_number, 'reason' => $response->json('failedreason')]);

            throw new RuntimeException('The payment page could not be opened. Please try again or choose another method.');
        }

        return $url;
    }

    public function confirm(StorePaymentGateway $account, array $payload, string $rawBody = '', array $headers = []): ?GatewayPayment
    {
        $valId = (string) ($payload['val_id'] ?? '');

        if ($valId === '') {
            return null;
        }

        $check = Http::timeout(20)->get($this->base($account).'/validator/api/validationserverAPI.php', [
            'val_id' => $valId,
            'store_id' => $account->credential('store_id'),
            'store_passwd' => $account->credential('store_password'),
            'format' => 'json',
        ]);

        if (! $check->ok() || ! $check->json('tran_id')) {
            return null;
        }

        $currency = (string) ($check->json('currency_type') ?: 'BDT');
        $amount = $check->json('currency_amount') ?: $check->json('amount');

        return new GatewayPayment(
            (string) $check->json('tran_id'),
            in_array($check->json('status'), ['VALID', 'VALIDATED'], true),
            Money::fromDecimal((string) $amount, $currency)?->amountMinor ?? 0,
            $currency,
            (string) ($check->json('bank_tran_id') ?: $valId),
            $check->json() ?? [],
        );
    }

    public function refund(StorePaymentGateway $account, PaymentAttempt $attempt, int $amountMinor, string $reason): string
    {
        $bankTranId = (string) ($attempt->gateway_payload['bank_tran_id'] ?? $attempt->provider_reference);

        $response = Http::timeout(20)->get($this->base($account).'/validator/api/merchantTransIDvalidationAPI.php', [
            'bank_tran_id' => $bankTranId,
            'refund_amount' => number_format((new Money($amountMinor, $attempt->currency_code))->toDecimal(), 2, '.', ''),
            'refund_remarks' => mb_substr($reason ?: 'Refund', 0, 200),
            'store_id' => $account->credential('store_id'),
            'store_passwd' => $account->credential('store_password'),
            'refe_id' => 'R'.$attempt->id.'-'.($attempt->refunded_minor + $amountMinor),
            'format' => 'json',
        ]);

        if (! $response->ok() || ! in_array($response->json('status'), ['success', 'processing'], true)) {
            Log::warning('payments.sslcommerz.refund_failed', ['attempt' => $attempt->id, 'reason' => $response->json('errorReason')]);

            throw new RuntimeException('SSLCommerz did not accept the refund: '.($response->json('errorReason') ?: 'unknown reason').'.');
        }

        return (string) ($response->json('refund_ref_id') ?: $response->json('trans_id') ?: 'sslcommerz-refund');
    }

    private function base(StorePaymentGateway $account): string
    {
        return $account->test_mode ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com';
    }
}
