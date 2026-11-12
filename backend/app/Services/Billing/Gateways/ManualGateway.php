<?php

namespace App\Services\Billing\Gateways;

use App\Models\Invoice;
use App\Models\Organization;

/**
 * No online checkout: the shop owner pays by bank or bKash transfer and the platform marks
 * the invoice paid (`php artisan billing:mark-paid INV-...`, or the platform admin screen).
 */
class ManualGateway implements BillingGateway
{
    public function name(): string
    {
        return 'manual';
    }

    public function checkoutUrl(Invoice $invoice, Organization $organization): ?string
    {
        return null;
    }

    public function confirm(array $payload): ?PaymentResult
    {
        return null;
    }
}
