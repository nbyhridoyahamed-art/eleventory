<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\AbuseReport;
use App\Models\Invoice;
use App\Models\Store;
use App\Models\Subscription;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/** The numbers a platform owner checks every morning. */
class OverviewController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $active = Subscription::with('plan')->where('status', Subscription::ACTIVE)->get();

        // Monthly recurring revenue: what active paying accounts bring in per month (yearly plans / 12).
        $mrr = $active->sum(fn (Subscription $s) => $s->billing_cycle === 'yearly'
            ? (float) $s->plan->priceFor('yearly') / 12
            : (float) $s->plan->priceFor('monthly'));

        $cancelled30 = Subscription::where('status', Subscription::CANCELLED)->where('cancelled_at', '>=', now()->subDays(30))->count();
        $paying = $active->filter(fn (Subscription $s) => (float) $s->plan->priceFor('monthly') > 0);

        return ApiResponse::success([
            'tenants' => [
                'total' => Store::count(),
                'active' => Store::where('status', 'active')->count(),
                'suspended' => Store::where('status', 'suspended')->count(),
                'new_30d' => Store::where('created_at', '>=', now()->subDays(30))->count(),
            ],
            'subscriptions' => [
                'trialing' => Subscription::where('status', Subscription::TRIALING)->count(),
                'trials_ending_7d' => Subscription::where('status', Subscription::TRIALING)->whereBetween('trial_ends_at', [now(), now()->addDays(7)])->count(),
                'active' => $active->count(),
                'paying' => $paying->count(),
                'past_due' => Subscription::where('status', Subscription::PAST_DUE)->count(),
                'suspended' => Subscription::where('status', Subscription::SUSPENDED)->count(),
                'cancelled_30d' => $cancelled30,
            ],
            'revenue' => [
                'currency' => 'BDT',
                'mrr' => round($mrr, 2),
                'collected_30d' => (float) Invoice::where('status', Invoice::PAID)->where('paid_at', '>=', now()->subDays(30))->sum('amount'),
                'churn_30d_percent' => ($active->count() + $cancelled30) > 0 ? round($cancelled30 / ($active->count() + $cancelled30) * 100, 1) : 0.0,
            ],
            'by_plan' => $active->groupBy(fn (Subscription $s) => $s->plan->name)->map->count()->all(),
            'open_reports' => AbuseReport::where('status', 'open')->count(),
        ], 'Overview fetched successfully.');
    }
}
