<?php

namespace App\Services\Payments;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\StorePaymentGateway;

/** One payment provider a store can take money through, using the store's own account. */
interface MerchantGateway
{
    public function key(): string;

    public function label(): string;

    public function description(): string;

    /** @return array<int, array{key: string, label: string, secret: bool}> */
    public function credentialFields(): array;

    /** A plain-language problem with the credentials (format only, no network), or null when they look right. */
    public function credentialProblem(array $credentials, bool $testMode): ?string;

    /**
     * Open a payment page for the attempt and return where to send the shopper.
     *
     * @param  array{success: string, fail: string, cancel: string, ipn: string}  $urls
     */
    public function startCheckout(StorePaymentGateway $account, PaymentAttempt $attempt, Order $order, array $urls): string;

    /** Ask the provider what really happened. null = not a recognisable / verifiable notification. */
    public function confirm(StorePaymentGateway $account, array $payload, string $rawBody = '', array $headers = []): ?GatewayPayment;

    /** Send money back. Returns the provider's refund reference. Throws RuntimeException with a safe message. */
    public function refund(StorePaymentGateway $account, PaymentAttempt $attempt, int $amountMinor, string $reason): string;
}
