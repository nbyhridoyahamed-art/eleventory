<?php

namespace App\Services\Payments;

/** A provider-verified outcome for one of our payment attempts, matched by `tranId` (our own reference). */
final class GatewayPayment
{
    public function __construct(
        public readonly string $tranId,
        public readonly bool $paid,
        public readonly int $amountMinor,
        public readonly string $currency,
        public readonly ?string $reference = null,
        public readonly array $raw = [],
    ) {}
}
