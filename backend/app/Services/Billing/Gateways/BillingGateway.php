<?php

namespace App\Services\Billing\Gateways;

use App\Models\Invoice;
use App\Models\Organization;

/**
 * How the platform collects subscription money. One implementation per payment provider;
 * the rest of billing only ever talks to this interface.
 */
interface BillingGateway
{
    /** Short name stored on invoices and subscriptions. */
    public function name(): string;

    /**
     * Begin paying an invoice. Returns the URL to send the shop owner to, or null when
     * there is nothing to open (manual transfers: the owner follows the invoice instructions).
     */
    public function checkoutUrl(Invoice $invoice, Organization $organization): ?string;

    /**
     * Turn a provider callback (webhook or browser return) into a verified result, asking the
     * provider itself whether the money really arrived: the payload alone is never trusted.
     * Returns null when it is not a payment we can confirm.
     */
    public function confirm(array $payload): ?PaymentResult;
}
