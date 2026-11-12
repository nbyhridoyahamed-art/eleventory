<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\PlatformAuditLog;
use App\Models\Store;
use App\Models\Subscription;
use App\Models\TenantNote;
use App\Services\Billing\BillingService;
use App\Services\Billing\PlanLimits;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The tenant directory and what a platform admin can do to a shop. Every change is audited. */
class TenantController extends Controller
{
    public function __construct(private BillingService $billing, private PlanLimits $limits) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate(['status' => ['nullable', Rule::in(['active', 'suspended'])], 'search' => ['nullable', 'string', 'max:100']]);

        $stores = Store::query()
            ->with(['organization.subscription.plan'])
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('search'), function ($q, $search) {
                $like = '%'.addcslashes($search, '%_\\').'%';
                $q->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('slug', 'like', $like)->orWhere('domain', 'like', $like)
                    ->orWhereHas('organization', fn ($o) => $o->where('email', 'like', $like)->orWhere('name', 'like', $like)));
            })
            ->latest('id')
            ->paginate(25);

        return ApiResponse::success(
            $stores->getCollection()->map(fn (Store $store) => $this->row($store))->all(),
            'Tenants fetched successfully.',
            ['current_page' => $stores->currentPage(), 'last_page' => $stores->lastPage(), 'total' => $stores->total()],
        );
    }

    public function show(Store $store): JsonResponse
    {
        $store->load(['organization.subscription.plan']);
        $organization = $store->organization;

        return ApiResponse::success($this->row($store) + [
            'usage' => $organization ? $this->limits->summary($organization) : [],
            'overrides' => $organization?->feature_overrides ?? ['limits' => [], 'features' => []],
            'invoices' => $organization ? Invoice::where('organization_id', $organization->id)->latest('id')->limit(10)->get()
                ->map(fn (Invoice $i) => ['id' => $i->id, 'number' => $i->number, 'status' => $i->status, 'amount' => (float) $i->amount, 'currency' => $i->currency, 'created_at' => $i->created_at?->toIso8601String()])->all() : [],
            'notes' => TenantNote::with('author:id,name')->where('store_id', $store->id)->latest('id')->limit(30)->get()
                ->map(fn (TenantNote $n) => ['id' => $n->id, 'body' => $n->body, 'author' => $n->author?->name, 'created_at' => $n->created_at?->toIso8601String()])->all(),
            'plans' => Plan::orderBy('sort_order')->get(['key', 'name', 'is_public'])->all(),
        ], 'Tenant fetched successfully.');
    }

    public function suspend(Request $request, Store $store): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        $store->forceFill(['status' => 'suspended', 'suspension_reason' => 'platform'])->save();
        PlatformAuditLog::record($request->user(), 'tenant.suspend', $store->id, ['reason' => $data['reason']]);

        return ApiResponse::success($this->row($store->fresh(['organization.subscription.plan'])), 'The shop is suspended.');
    }

    public function restore(Request $request, Store $store): JsonResponse
    {
        $store->forceFill(['status' => 'active', 'suspension_reason' => null])->save();
        PlatformAuditLog::record($request->user(), 'tenant.restore', $store->id);

        return ApiResponse::success($this->row($store->fresh(['organization.subscription.plan'])), 'The shop is back online.');
    }

    /** Put an account on a plan without payment (comps, deals, support fixes), optionally extending the trial. */
    public function setPlan(Request $request, Store $store): JsonResponse
    {
        $data = $request->validate([
            'plan' => ['required', 'string', 'exists:plans,key'],
            'status' => ['required', Rule::in([Subscription::ACTIVE, Subscription::TRIALING])],
            'days' => ['nullable', 'integer', 'min:1', 'max:3650'],
        ]);

        $organization = $store->organization()->firstOrFail();
        $subscription = $this->billing->override($organization, Plan::where('key', $data['plan'])->firstOrFail(), $data['status'], $data['days'] ?? null);
        PlatformAuditLog::record($request->user(), 'tenant.plan_override', $store->id, $data);

        return ApiResponse::success($this->row($store->fresh(['organization.subscription.plan'])), 'Plan updated.');
    }

    /** Per-account limits and feature switches that win over the plan. null/absent = follow the plan. */
    public function setOverrides(Request $request, Store $store): JsonResponse
    {
        $data = $request->validate([
            'limits' => ['nullable', 'array'],
            'limits.*' => ['nullable', 'integer', 'min:0'],
            'features' => ['nullable', 'array'],
            'features.*' => ['boolean'],
        ]);

        $allowedLimits = ['products', 'staff', 'orders_per_month', 'custom_domains'];
        $overrides = [
            'limits' => array_intersect_key($data['limits'] ?? [], array_flip($allowedLimits)),
            'features' => array_map('boolval', $data['features'] ?? []),
        ];

        $organization = $store->organization()->firstOrFail();
        $organization->forceFill(['feature_overrides' => $overrides])->save();
        $this->limits->flush();
        PlatformAuditLog::record($request->user(), 'tenant.overrides', $store->id, $overrides);

        return ApiResponse::success($overrides, 'Overrides saved.');
    }

    public function addNote(Request $request, Store $store): JsonResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'max:2000']]);
        $note = TenantNote::create(['store_id' => $store->id, 'user_id' => $request->user()->id, 'body' => $data['body']]);

        return ApiResponse::success(['id' => $note->id], 'Note added.', status: 201);
    }

    /** Called when an admin opens a shop they are not a member of (support mode). */
    public function enter(Request $request, Store $store): JsonResponse
    {
        $request->user()->forceFill(['current_store_id' => $store->id])->save();
        PlatformAuditLog::record($request->user(), 'tenant.enter', $store->id);

        return ApiResponse::success(['current_store_id' => $store->id], 'You are now viewing this shop as support.');
    }

    private function row(Store $store): array
    {
        $organization = $store->organization;
        $subscription = $organization?->subscription;

        return [
            'id' => $store->id,
            'name' => $store->name,
            'slug' => $store->slug,
            'domain' => $store->domain,
            'status' => $store->status,
            'suspension_reason' => $store->suspension_reason,
            'owner_email' => $organization?->email,
            'created_at' => $store->created_at?->toIso8601String(),
            'plan' => $subscription?->plan ? ['key' => $subscription->plan->key, 'name' => $subscription->plan->name] : null,
            'subscription_status' => $subscription?->status,
            'trial_ends_at' => $subscription?->trial_ends_at?->toIso8601String(),
            'current_period_end' => $subscription?->current_period_end?->toIso8601String(),
        ];
    }
}
