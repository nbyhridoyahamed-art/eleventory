<?php

namespace App\Services\Billing\Gateways;

/** A provider-verified outcome for one of our invoices (matched by `tranId`, our own reference). */
final class PaymentResult
{
    public function __construct(
        public readonly string $tranId,
        public readonly bool $paid,
        public readonly string $amount,
        public readonly string $currency,
        public readonly array $raw = [],
    ) {}
}
