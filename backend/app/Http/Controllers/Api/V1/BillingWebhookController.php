<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Services\Billing\BillingService;
use App\Services\Billing\Gateways\SslCommerzGateway;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;

/**
 * Where payment providers talk back. Nothing here trusts the request: the gateway asks the
 * provider whether the money is real, and BillingService checks it matches the invoice.
 */
class BillingWebhookController extends Controller
{
    public function __construct(private BillingService $billing) {}

    /** SSLCommerz IPN: server to server, any number of times. */
    public function sslcommerz(Request $request): Response
    {
        $this->settle(new SslCommerzGateway, $request->all());

        return response('OK', 200);
    }

    /** The shopper's browser coming back from the payment page (success | fail | cancel). */
    public function back(Request $request, string $outcome): RedirectResponse
    {
        $paid = false;

        if ($outcome === 'success' && config('billing.gateway') === 'sslcommerz') {
            $paid = $this->settle(new SslCommerzGateway, $request->all());
        }

        return $this->toBilling($paid ? 'success' : ($outcome === 'cancel' ? 'cancelled' : 'failed'));
    }

    /** Development only: pretend the owner paid. */
    public function fakePay(string $tranId): RedirectResponse
    {
        abort_unless(config('billing.gateway') === 'fake' && app()->environment(['local', 'testing']), 404);

        $invoice = Invoice::where('tran_id', $tranId)->firstOrFail();
        $this->billing->markPaid($invoice, ['fake' => true]);

        return $this->toBilling('success');
    }

    private function settle(SslCommerzGateway $gateway, array $payload): bool
    {
        try {
            $result = $gateway->confirm($payload);
        } catch (\Throwable $e) {
            Log::warning('billing.webhook.confirm_failed', ['error' => $e->getMessage()]);

            return false;
        }

        if (! $result) {
            return false;
        }

        $invoice = $this->billing->handlePayment($result);

        return $invoice?->status === Invoice::PAID;
    }

    private function toBilling(string $outcome): RedirectResponse
    {
        return redirect()->away(rtrim((string) config('app.frontend_url'), '/')."/dashboard/settings/billing?payment={$outcome}");
    }
}
