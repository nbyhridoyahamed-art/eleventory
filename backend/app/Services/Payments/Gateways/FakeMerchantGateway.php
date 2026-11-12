<?php

namespace App\Services\Payments\Gateways;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\StorePaymentGateway;
use App\Services\Payments\GatewayPayment;
use App\Services\Payments\MerchantGateway;

/** Development and tests only: a "payment page" that approves anything. Never offered outside local/testing. */
class FakeMerchantGateway implements MerchantGateway
{
    public function key(): string
    {
        return 'fake';
    }

    public function label(): string
    {
        return 'Test payment (development)';
    }

    public function description(): string
    {
        return 'Pretend payments for development. Not available in production.';
    }

    public function credentialFields(): array
    {
        return [];
    }

    public function credentialProblem(array $credentials, bool $testMode): ?string
    {
        return null;
    }

    public function startCheckout(StorePaymentGateway $account, PaymentAttempt $attempt, Order $order, array $urls): string
    {
        return url("/api/v1/payments/fake/{$attempt->tran_id}/pay");
    }

    public function confirm(StorePaymentGateway $account, array $payload, string $rawBody = '', array $headers = []): ?GatewayPayment
    {
        // The payload is whatever the test passes; it is only ever read in local/testing.
        if (! isset($payload['tran_id'], $payload['amount_minor'])) {
            return null;
        }

        return new GatewayPayment((string) $payload['tran_id'], (bool) ($payload['paid'] ?? true), (int) $payload['amount_minor'], (string) ($payload['currency'] ?? 'BDT'), 'FAKE-'.$payload['tran_id'], $payload);
    }

    public function refund(StorePaymentGateway $account, PaymentAttempt $attempt, int $amountMinor, string $reason): string
    {
        return 'FAKE-REFUND-'.$attempt->tran_id;
    }
}
