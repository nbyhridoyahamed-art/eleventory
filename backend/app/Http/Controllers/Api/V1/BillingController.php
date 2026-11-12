<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Store;
use App\Models\Subscription;
use App\Services\Billing\BillingService;
use App\Services\Billing\PlanLimits;
use App\Support\ApiResponse;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/** The signed-in account's plan, usage, invoices and the actions on them. */
class BillingController extends Controller
{
    public function __construct(private BillingService $billing, private PlanLimits $limits) {}

    public function show(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $subscription = Subscription::with(['plan', 'pendingPlan'])->where('organization_id', $organization->id)->first();

        return ApiResponse::success([
            'subscription' => $subscription ? $this->presentSubscription($subscription) : null,
            'usage' => $this->limits->summary($organization),
            'invoices' => Invoice::where('organization_id', $organization->id)->latest('id')->limit(12)->get()
                ->map(fn (Invoice $invoice) => $this->presentInvoice($invoice))->all(),
            'plans' => Plan::purchasable()->get()->map(fn (Plan $plan) => PlanController::present($plan))->all(),
            'gateway' => config('billing.gateway'),
            'manual_instructions' => config('billing.gateway') === 'manual' ? config('billing.manual_instructions') : null,
        ], 'Billing fetched successfully.');
    }

    public function subscribe(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $data = $request->validate([
            'plan' => ['required', 'string', 'exists:plans,key'],
            'cycle' => ['required', 'in:monthly,yearly'],
        ]);

        $invoice = $this->billing->subscribe($organization, Plan::where('key', $data['plan'])->firstOrFail(), $data['cycle']);

        // A scheduled downgrade has no invoice.
        if (! $invoice) {
            return ApiResponse::success(['scheduled' => true, 'invoice' => null, 'checkout_url' => null], 'Your plan will change at the end of the current period.');
        }

        return ApiResponse::success([
            'scheduled' => false,
            'invoice' => $this->presentInvoice($invoice),
            'checkout_url' => $invoice->isOpen() ? $this->checkoutUrl($invoice) : null,
        ], $invoice->isOpen() ? 'Invoice created.' : 'Your plan is active.', status: 201);
    }

    public function pay(Request $request, Invoice $invoice): JsonResponse
    {
        $organization = $this->organization($request);
        abort_unless($invoice->organization_id === $organization->id, 404);

        return ApiResponse::success(['checkout_url' => $this->checkoutUrl($invoice)], 'Checkout ready.');
    }

    public function cancel(Request $request): JsonResponse
    {
        $subscription = $this->billing->cancel($this->organization($request));

        return ApiResponse::success($this->presentSubscription($subscription->load(['plan', 'pendingPlan'])), 'Your subscription will end at the close of the current period.');
    }

    public function resume(Request $request): JsonResponse
    {
        $subscription = $this->billing->resume($this->organization($request));

        return ApiResponse::success($this->presentSubscription($subscription->load(['plan', 'pendingPlan'])), 'Your subscription will continue.');
    }

    private function checkoutUrl(Invoice $invoice): ?string
    {
        try {
            return $this->billing->checkoutUrl($invoice);
        } catch (RuntimeException $e) {
            abort(502, $e->getMessage());
        }
    }

    private function organization(Request $request): Organization
    {
        if (! $request->user()->can('settings.manage')) {
            throw new AuthorizationException;
        }

        $storeId = app(TenantContext::class)->storeId() ?? (int) $request->user()->current_store_id;

        return Store::query()->findOrFail($storeId)->organization()->firstOrFail();
    }

    private function presentSubscription(Subscription $s): array
    {
        return [
            'status' => $s->status,
            'plan' => ['key' => $s->plan->key, 'name' => $s->plan->name],
            'pending_plan' => $s->pendingPlan ? ['key' => $s->pendingPlan->key, 'name' => $s->pendingPlan->name] : null,
            'billing_cycle' => $s->billing_cycle,
            'trial_ends_at' => $s->trial_ends_at?->toIso8601String(),
            'trial_days_left' => $s->status === Subscription::TRIALING && $s->trial_ends_at ? max(0, (int) ceil(now()->floatDiffInDays($s->trial_ends_at, false))) : null,
            'current_period_end' => $s->current_period_end?->toIso8601String(),
            'grace_ends_at' => $s->grace_ends_at?->toIso8601String(),
            'cancel_at_period_end' => $s->cancel_at_period_end,
        ];
    }

    private function presentInvoice(Invoice $invoice): array
    {
        return [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'status' => $invoice->status,
            'amount' => (float) $invoice->amount,
            'currency' => $invoice->currency,
            'description' => $invoice->description,
            'billing_cycle' => $invoice->billing_cycle,
            'due_at' => $invoice->due_at?->toIso8601String(),
            'paid_at' => $invoice->paid_at?->toIso8601String(),
            'created_at' => $invoice->created_at?->toIso8601String(),
        ];
    }
}
