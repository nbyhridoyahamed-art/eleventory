<?php

namespace App\Http\Middleware;

use App\Models\Subscription;
use App\Services\Billing\PlanLimits;
use App\Support\ApiResponse;
use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * An account whose subscription has lapsed (suspended or cancelled) can still sign in, look
 * around and pay, but cannot change anything: every write is refused with 402 except the
 * billing screens themselves. Past-due accounts are still inside their grace period and work
 * normally. Does nothing outside SaaS mode or for accounts without a subscription.
 */
class EnsureSubscriptionActive
{
    public function __construct(private PlanLimits $limits) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! config('app.saas_mode') || $request->isMethodSafe() || $request->is('api/v1/billing*', 'api/v1/auth/*', 'api/v1/onboarding')) {
            return $next($request);
        }

        $storeId = app(TenantContext::class)->storeId();
        $organization = $storeId ? $this->limits->organizationForStore($storeId) : null;
        $subscription = $organization ? $this->limits->subscription($organization) : null;

        if ($subscription && in_array($subscription->status, [Subscription::SUSPENDED, Subscription::CANCELLED], true)) {
            return ApiResponse::error(
                'Your subscription is not active. Pay your invoice or choose a plan to make changes again.',
                ['code' => ['subscription_inactive']],
                402,
            );
        }

        return $next($request);
    }
}
