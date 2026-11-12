<?php

namespace App\Services\Billing;

use App\Models\Invoice;
use App\Models\Media;
use App\Models\Order;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Store;
use App\Models\StoreDomain;
use App\Models\Subscription;
use App\Models\Scopes\TenantScope;
use App\Support\ApiResponse;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

/**
 * What the account's plan allows, and how much of it is used.
 *
 * Enforced only in SaaS mode and only for accounts that have a subscription, so the
 * single-store site and any account that predates billing are never limited. A limit
 * that is absent or null means unlimited.
 */
class PlanLimits
{
    public const RESOURCES = ['products', 'staff', 'orders_per_month', 'custom_domains', 'storage_mb'];

    /** @var array<int, Subscription|null> */
    private array $subscriptions = [];

    public function enforced(): bool
    {
        return (bool) config('app.saas_mode');
    }

    public function organizationForStore(int $storeId): ?Organization
    {
        return Store::query()->find($storeId)?->organization;
    }

    public function subscription(Organization $organization): ?Subscription
    {
        return $this->subscriptions[$organization->id] ??= Subscription::with('plan')->where('organization_id', $organization->id)->first();
    }

    /** Forget cached subscriptions (after the billing service changes one). */
    public function flush(): void
    {
        $this->subscriptions = [];
    }

    public function plan(Organization $organization): ?Plan
    {
        return $this->subscription($organization)?->plan;
    }

    public function limit(Organization $organization, string $resource): ?int
    {
        $overrides = $organization->feature_overrides['limits'] ?? [];

        if (array_key_exists($resource, $overrides)) {
            return $overrides[$resource] === null ? null : (int) $overrides[$resource];
        }

        return $this->plan($organization)?->limit($resource);
    }

    public function feature(Organization $organization, string $name): bool
    {
        $plan = $this->plan($organization);
        $overrides = $organization->feature_overrides['features'] ?? [];

        if (array_key_exists($name, $overrides)) {
            return (bool) $overrides[$name];
        }

        return $plan === null || ! $this->enforced() || $plan->feature($name);
    }

    public function usage(Organization $organization, string $resource): int
    {
        $storeIds = Store::query()->where('organization_id', $organization->id)->pluck('id');

        return match ($resource) {
            'products' => Product::withoutGlobalScope(TenantScope::class)->whereIn('store_id', $storeIds)->count(),
            'staff' => (int) DB::table('store_user')->whereIn('store_id', $storeIds)->where('status', 'active')->distinct()->count('user_id'),
            'orders_per_month' => Order::withoutGlobalScope(TenantScope::class)->whereIn('store_id', $storeIds)->where('created_at', '>=', now()->startOfMonth())->count(),
            'custom_domains' => StoreDomain::withoutGlobalScopes()->whereIn('store_id', $storeIds)->count(),
            'storage_mb' => (int) ceil($this->storageBytes($organization) / 1048576),
            default => 0,
        };
    }

    /** Usage of every limited resource, for the billing screen. */
    public function summary(Organization $organization): array
    {
        return collect(self::RESOURCES)->map(fn (string $resource) => [
            'resource' => $resource,
            'used' => $this->usage($organization, $resource),
            'limit' => $this->limit($organization, $resource),
        ])->all();
    }

    public function canAdd(Organization $organization, string $resource, int $adding = 1): bool
    {
        if (! $this->enforced()) {
            return true;
        }

        $limit = $this->limit($organization, $resource);

        return $limit === null || $this->usage($organization, $resource) + $adding <= $limit;
    }

    /** Refuse (402) when adding $adding more of $resource would pass the plan's limit. */
    public function assertCanAdd(int $storeId, string $resource, int $adding = 1): void
    {
        if (! $this->enforced() || ! ($organization = $this->organizationForStore($storeId))) {
            return;
        }

        if (! $this->canAdd($organization, $resource, $adding)) {
            throw $this->limitReached($organization, $resource);
        }
    }

    /** Refuse (402) when storing $bytes more would pass the plan's file storage allowance (storage_mb). */
    public function assertStorage(int $storeId, int $bytes): void
    {
        if (! $this->enforced() || ! ($organization = $this->organizationForStore($storeId))) {
            return;
        }

        $limitMb = $this->limit($organization, 'storage_mb');

        if ($limitMb !== null && $this->storageBytes($organization) + $bytes > $limitMb * 1048576) {
            throw $this->limitReached($organization, 'storage_mb');
        }
    }

    /** Bytes of uploaded files across all of the account's shops. */
    public function storageBytes(Organization $organization): int
    {
        $storeIds = Store::query()->where('organization_id', $organization->id)->pluck('id');

        return (int) Media::withoutGlobalScope(TenantScope::class)->whereIn('store_id', $storeIds)->sum('size');
    }

    /** Refuse (402) when the plan does not include a feature. */
    public function assertFeature(int $storeId, string $feature): void
    {
        if (! $this->enforced() || ! ($organization = $this->organizationForStore($storeId))) {
            return;
        }

        if (! $this->feature($organization, $feature)) {
            throw new HttpResponseException(ApiResponse::error(
                'This feature is not included in your plan. Upgrade to use it.',
                ['code' => ['plan_feature_missing'], 'feature' => [$feature]],
                402,
            ));
        }
    }

    /** Would the account fit inside $plan right now? Returns the resources that would not. */
    public function overages(Organization $organization, Plan $plan): array
    {
        $over = [];

        foreach (self::RESOURCES as $resource) {
            $limit = $plan->limit($resource);
            $used = $this->usage($organization, $resource);

            if ($limit !== null && $used > $limit) {
                $over[$resource] = ['used' => $used, 'limit' => $limit];
            }
        }

        return $over;
    }

    public function hasOpenInvoice(Organization $organization): bool
    {
        return Invoice::where('organization_id', $organization->id)->where('status', Invoice::OPEN)->exists();
    }

    private function limitReached(Organization $organization, string $resource): HttpResponseException
    {
        $limit = $this->limit($organization, $resource);
        $label = ['products' => 'products', 'staff' => 'staff accounts', 'orders_per_month' => 'orders this month', 'custom_domains' => 'custom domains', 'storage_mb' => 'MB of file storage'][$resource] ?? $resource;

        return new HttpResponseException(ApiResponse::error(
            "Your plan allows {$limit} {$label}. Upgrade your plan to add more.",
            ['code' => ['plan_limit_reached'], 'resource' => [$resource], 'limit' => [(string) $limit]],
            402,
        ));
    }
}
