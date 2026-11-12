<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\StorePaymentGateway;
use App\Services\Payments\Gateways\FakeMerchantGateway;
use App\Services\Payments\MerchantGateways;
use App\Services\Payments\MerchantPayments;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

/**
 * Where payment providers talk back for a store. Public by necessity, so nothing is taken on
 * trust: the provider is asked (or its signature checked) with the STORE's own credentials, and
 * the amount must match what we asked for. Always tenant-scoped to the attempt's store.
 */
class PaymentWebhookController extends Controller
{
    public function __construct(private MerchantGateways $gateways, private MerchantPayments $payments, private TenantContext $tenant) {}

    /** Server to server: SSLCommerz IPN, Stripe webhook. */
    public function webhook(Request $request, string $provider, int $storeId): Response
    {
        $gateway = $this->gateways->get($provider);
        $account = StorePaymentGateway::withoutGlobalScopes()->where('store_id', $storeId)->where('provider', $provider)->first();

        if (! $gateway || ! $account || $provider === 'fake') {
            return response('Unknown', 404);
        }

        $this->tenant->set($storeId);

        try {
            $result = $gateway->confirm($account, $request->json()->all() ?: $request->all(), $request->getContent(), ['stripe-signature' => (string) $request->header('Stripe-Signature')]);

            if (! $result) {
                // A bad signature must not be answered 200, or a provider would stop retrying a real event.
                return response('Ignored', $provider === 'stripe' ? 400 : 200);
            }

            $attempt = PaymentAttempt::query()->where('tran_id', $result->tranId)->where('provider', $provider)->first();

            if ($attempt) {
                $this->payments->settle($attempt, $result);
            }

            return response('OK', 200);
        } catch (\Throwable $e) {
            Log::warning('payments.webhook_failed', ['provider' => $provider, 'store' => $storeId, 'error' => $e->getMessage()]);

            return response('Error', 500);
        } finally {
            $this->tenant->forget();
        }
    }

    /** The shopper's browser coming back from the payment page. */
    public function back(Request $request, string $tranId, string $outcome): RedirectResponse
    {
        $attempt = PaymentAttempt::withoutGlobalScopes()->where('tran_id', $tranId)->firstOrFail();
        $this->tenant->set($attempt->store_id);

        try {
            $status = 'processing';

            if ($outcome === 'success' && $attempt->provider === 'sslcommerz') {
                $account = StorePaymentGateway::query()->where('provider', 'sslcommerz')->first();
                $result = $account ? $this->gateways->get('sslcommerz')?->confirm($account, $request->all()) : null;
                $status = $result && $this->payments->settle($attempt, $result)->status === PaymentAttempt::PAID ? 'paid' : 'failed';
            } elseif ($outcome === 'success') {
                // Stripe (and others): the webhook is the source of truth; the page polls the order.
                $status = $attempt->fresh()->status === PaymentAttempt::PAID ? 'paid' : 'processing';
            } else {
                $this->payments->markCancelled($attempt, $outcome === 'fail' ? PaymentAttempt::FAILED : PaymentAttempt::CANCELLED);
                $status = $outcome === 'fail' ? 'failed' : 'cancelled';
            }

            $order = Order::query()->find($attempt->order_id);

            return redirect()->away($this->base($attempt)."/checkout/payment-result?order={$order?->uuid}&status={$status}");
        } finally {
            $this->tenant->forget();
        }
    }

    /** Development only: approve a pretend payment. */
    public function fakePay(string $tranId): RedirectResponse
    {
        abort_unless(app()->environment(['local', 'testing']), 404);

        $attempt = PaymentAttempt::withoutGlobalScopes()->where('tran_id', $tranId)->where('provider', 'fake')->firstOrFail();
        $this->tenant->set($attempt->store_id);

        try {
            $result = (new FakeMerchantGateway)->confirm(new StorePaymentGateway, ['tran_id' => $attempt->tran_id, 'amount_minor' => $attempt->amount_minor, 'currency' => $attempt->currency_code]);
            $this->payments->settle($attempt, $result);
            $order = Order::query()->find($attempt->order_id);

            return redirect()->away($this->base($attempt)."/checkout/payment-result?order={$order?->uuid}&status=paid");
        } finally {
            $this->tenant->forget();
        }
    }

    private function base(PaymentAttempt $attempt): string
    {
        return rtrim($attempt->return_url ?: (string) config('app.frontend_url'), '/');
    }
}
