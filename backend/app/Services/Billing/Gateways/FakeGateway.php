<?php

namespace App\Services\Billing\Gateways;

use App\Models\Invoice;
use App\Models\Organization;

/**
 * Local development and tests only: "checkout" is a link on our own API that marks the
 * invoice paid, so the whole subscribe -> pay -> active journey can be tried without money.
 * Refused outside local/testing environments.
 */
class FakeGateway implements BillingGateway
{
    public function name(): string
    {
        return 'fake';
    }

    public function checkoutUrl(Invoice $invoice, Organization $organization): ?string
    {
        abort_unless(app()->environment(['local', 'testing']), 500, 'The fake billing gateway is for development only.');

        return url("/api/v1/billing/fake/{$invoice->tran_id}/pay");
    }

    public function confirm(array $payload): ?PaymentResult
    {
        if (! app()->environment(['local', 'testing']) || empty($payload['tran_id'])) {
            return null;
        }

        $invoice = Invoice::where('tran_id', $payload['tran_id'])->first();

        return $invoice
            ? new PaymentResult($invoice->tran_id, ($payload['status'] ?? 'paid') === 'paid', (string) $invoice->amount, $invoice->currency, ['fake' => true])
            : null;
    }
}
