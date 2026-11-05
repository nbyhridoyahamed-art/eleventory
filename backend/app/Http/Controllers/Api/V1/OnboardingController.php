<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DeliveryZone;
use App\Models\Product;
use App\Models\Store;
use App\Support\ApiResponse;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The "get your store ready" checklist shown on the dashboard. Every step is
 * worked out from real data, so it ticks itself off as the owner does the work.
 */
class OnboardingController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $storeId = app(TenantContext::class)->storeId() ?? (int) $user->current_store_id;
        $store = Store::with('organization')->find($storeId);

        if (! $store) {
            return ApiResponse::success(['steps' => [], 'completed' => 0, 'total' => 0, 'trial' => null], 'No store selected.');
        }

        // Explicit store_id on every count: correct whether or not tenancy scoping is switched on.
        $steps = [
            ['key' => 'verify_email', 'label' => 'Verify your email address', 'done' => $user->email_verified_at !== null, 'href' => null],
            ['key' => 'first_product', 'label' => 'Add your first product', 'done' => Product::where('store_id', $store->id)->exists(), 'href' => '/dashboard/catalog/products/new'],
            ['key' => 'shipping', 'label' => 'Set up delivery zones and rates', 'done' => DeliveryZone::where('store_id', $store->id)->exists(), 'href' => '/dashboard/delivery/zones'],
            ['key' => 'store_details', 'label' => 'Review your store details', 'done' => filled($store->domain) || $store->updated_at->gt($store->created_at->addMinute()), 'href' => '/dashboard/settings/general'],
            ['key' => 'domain', 'label' => 'Connect your own domain (optional)', 'done' => filled($store->domain), 'href' => '/dashboard/settings/general', 'optional' => true],
        ];

        $required = array_filter($steps, fn ($step) => empty($step['optional']));
        $completed = count(array_filter($required, fn ($step) => $step['done']));
        $organization = $store->organization;

        return ApiResponse::success([
            'store' => ['id' => $store->id, 'name' => $store->name, 'slug' => $store->slug],
            'steps' => $steps,
            'completed' => $completed,
            'total' => count($required),
            'trial' => $organization?->plan === 'trial' && $organization->trial_ends_at ? [
                'ends_at' => $organization->trial_ends_at->toIso8601String(),
                'days_left' => max(0, (int) ceil(now()->floatDiffInDays($organization->trial_ends_at, false))),
            ] : null,
        ], 'Onboarding progress fetched successfully.');
    }
}
