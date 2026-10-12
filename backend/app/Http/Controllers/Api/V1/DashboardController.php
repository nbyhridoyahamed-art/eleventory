<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Support\ApiResponse;
use App\Support\Money;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Dashboard aggregates span multiple models (orders/order_items) rather
 * than mapping to one Eloquent policy, so — same as
 * StockLevelController::lowStockCount() — these check a permission
 * directly instead of going through a resource policy.
 */
class DashboardController extends Controller
{
    /**
     * Orders placed and revenue booked per day for the trailing N days
     * (default 14, max 90). Cancelled orders are excluded — this is a
     * sales-activity trend, not an audit of every order ever created.
     * Revenue is the sum of order_items line totals (quantity x
     * unit_price_amount); it deliberately excludes shipping/discount,
     * so it won't exactly match an individual order's `total_amount` —
     * a per-order figure belongs on the order itself, this is a trend.
     * Days with no orders are zero-filled so the chart's x-axis is
     * continuous.
     */
    public function salesTrend(Request $request): JsonResponse
    {
        if (! $request->user()->can('orders.view')) {
            throw new AuthorizationException;
        }

        $request->validate([
            'store_id' => ['required', 'exists:stores,id'],
            'days' => ['nullable', 'integer', 'min:1', 'max:90'],
        ]);

        $storeId = $request->integer('store_id');
        $days = $request->integer('days', 14);
        $currencyCode = Store::find($storeId)?->currency?->code ?? 'BDT';
        $start = Carbon::today()->subDays($days - 1);

        $rows = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.store_id', $storeId)
            ->where('orders.status', '!=', 'cancelled')
            ->where('orders.created_at', '>=', $start)
            ->selectRaw('DATE(orders.created_at) as date, COUNT(DISTINCT orders.id) as orders_count, SUM(order_items.quantity * order_items.unit_price_amount) as revenue_minor')
            ->groupBy('date')
            ->get()
            ->keyBy(fn ($row) => Carbon::parse($row->date)->toDateString());

        $trend = [];
        for ($i = 0; $i < $days; $i++) {
            $date = $start->copy()->addDays($i)->toDateString();
            $row = $rows->get($date);

            $trend[] = [
                'date' => $date,
                'orders_count' => $row?->orders_count ?? 0,
                'revenue_amount' => (new Money((int) ($row?->revenue_minor ?? 0), $currencyCode))->toDecimal(),
            ];
        }

        return ApiResponse::success($trend, 'Sales trend fetched successfully.');
    }

    /** Order counts grouped by status, zero-filled for every known status. */
    public function orderStatusBreakdown(Request $request): JsonResponse
    {
        if (! $request->user()->can('orders.view')) {
            throw new AuthorizationException;
        }

        $request->validate(['store_id' => ['required', 'exists:stores,id']]);

        $counts = DB::table('orders')
            ->where('store_id', $request->integer('store_id'))
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $breakdown = [];
        foreach (['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as $status) {
            $breakdown[$status] = (int) ($counts[$status] ?? 0);
        }

        return ApiResponse::success($breakdown, 'Order status breakdown fetched successfully.');
    }

    /**
     * One payload for the dashboard's insight panels: period KPIs with the
     * change against the previous equal period, top products and categories,
     * payment-method and order-source mix, orders by weekday, low-stock
     * products and the delivery pipeline. Cancelled orders are left out of
     * revenue and counts, matching salesTrend().
     */
    public function insights(Request $request): JsonResponse
    {
        if (! $request->user()->can('orders.view')) {
            throw new AuthorizationException;
        }

        $request->validate([
            'store_id' => ['required', 'exists:stores,id'],
            'days' => ['nullable', 'integer', 'min:7', 'max:90'],
        ]);

        $storeId = $request->integer('store_id');
        $days = $request->integer('days', 30);
        $currency = Store::find($storeId)?->currency?->code ?? 'BDT';
        $money = fn (int|float $minor) => (new Money((int) round($minor), $currency))->toDecimal();

        $periodStart = Carbon::today()->subDays($days - 1);
        $previousStart = $periodStart->copy()->subDays($days);

        // One row per order for both periods; grouped in PHP so the SQL stays portable.
        $orders = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.store_id', $storeId)
            ->where('orders.status', '!=', 'cancelled')
            ->where('orders.created_at', '>=', $previousStart)
            ->groupBy('orders.id', 'orders.created_at', 'orders.payment_method', 'orders.source', 'orders.customer_id')
            ->selectRaw('orders.id, orders.created_at, orders.payment_method, orders.source, orders.customer_id, SUM(order_items.quantity * order_items.unit_price_amount) as revenue_minor')
            ->get()
            ->map(function ($row) {
                $row->created = Carbon::parse($row->created_at);

                return $row;
            });

        $current = $orders->filter(fn ($o) => $o->created->gte($periodStart));
        $previous = $orders->filter(fn ($o) => $o->created->lt($periodStart));

        $kpi = function ($now, $before, bool $isMoney) use ($money) {
            $change = $before == 0 ? null : round((($now - $before) / $before) * 100, 1);

            return [
                'value' => $isMoney ? $money($now) : $now,
                'previous' => $isMoney ? $money($before) : $before,
                'change_percent' => $change,
            ];
        };

        $revenueNow = (float) $current->sum('revenue_minor');
        $revenueBefore = (float) $previous->sum('revenue_minor');
        $ordersNow = $current->count();
        $ordersBefore = $previous->count();
        $aovNow = $ordersNow > 0 ? $revenueNow / $ordersNow : 0;
        $aovBefore = $ordersBefore > 0 ? $revenueBefore / $ordersBefore : 0;

        $newCustomers = fn ($from, $to) => DB::table('customers')
            ->where('store_id', $storeId)
            ->where('created_at', '>=', $from)
            ->when($to, fn ($q) => $q->where('created_at', '<', $to))
            ->count();

        $cancelled = DB::table('orders')->where('store_id', $storeId)->where('status', 'cancelled')->where('created_at', '>=', $periodStart)->count();
        $allInPeriod = $ordersNow + $cancelled;

        $itemsBase = fn () => DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->where('orders.store_id', $storeId)
            ->where('orders.status', '!=', 'cancelled')
            ->where('orders.created_at', '>=', $periodStart);

        $topProducts = $itemsBase()
            ->groupBy('products.id', 'products.name')
            ->orderByDesc(DB::raw('SUM(order_items.quantity * order_items.unit_price_amount)'))
            ->limit(8)
            ->selectRaw('products.id, products.name, SUM(order_items.quantity) as units, SUM(order_items.quantity * order_items.unit_price_amount) as revenue_minor')
            ->get()
            ->map(fn ($r) => ['id' => $r->id, 'name' => $r->name, 'units' => (int) $r->units, 'revenue_amount' => $money($r->revenue_minor)])
            ->all();

        $byCategory = $itemsBase()
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->groupBy('categories.name')
            ->orderByDesc(DB::raw('SUM(order_items.quantity * order_items.unit_price_amount)'))
            ->limit(6)
            ->selectRaw('categories.name as name, SUM(order_items.quantity * order_items.unit_price_amount) as revenue_minor')
            ->get()
            ->map(fn ($r) => ['name' => $r->name ?? 'Uncategorised', 'revenue_amount' => $money($r->revenue_minor)])
            ->all();

        $paymentMix = $current->groupBy('payment_method')
            ->map(fn ($rows, $method) => ['method' => $method ?: 'unknown', 'orders' => $rows->count(), 'revenue_amount' => $money($rows->sum('revenue_minor'))])
            ->sortByDesc('orders')->values()->all();

        $sourceMix = $current->groupBy('source')
            ->map(fn ($rows, $source) => ['source' => $source ?: 'admin', 'orders' => $rows->count(), 'revenue_amount' => $money($rows->sum('revenue_minor'))])
            ->sortByDesc('orders')->values()->all();

        $weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        $weekday = collect(range(0, 6))->map(fn ($d) => [
            'day' => $weekdayNames[$d],
            'orders' => $current->filter(fn ($o) => $o->created->dayOfWeek === $d)->count(),
        ])->all();

        $hourly = collect(range(0, 23))->map(fn ($h) => [
            'hour' => sprintf('%02d:00', $h),
            'orders' => $current->filter(fn ($o) => $o->created->hour === $h)->count(),
        ])->all();

        $lowStock = DB::table('products')
            ->join('stock_levels', 'stock_levels.product_id', '=', 'products.id')
            ->where('products.store_id', $storeId)
            ->where('products.track_stock', true)
            ->whereNull('products.deleted_at')
            ->whereNotNull('products.low_stock_threshold')
            ->whereNull('stock_levels.product_variant_id')
            ->groupBy('products.id', 'products.name', 'products.sku', 'products.low_stock_threshold')
            ->havingRaw('SUM(stock_levels.quantity) <= products.low_stock_threshold')
            ->orderByRaw('SUM(stock_levels.quantity) asc')
            ->limit(6)
            ->selectRaw('products.id, products.name, products.sku, products.low_stock_threshold, SUM(stock_levels.quantity) as quantity')
            ->get()
            ->map(fn ($r) => ['id' => $r->id, 'name' => $r->name, 'sku' => $r->sku, 'quantity' => (int) $r->quantity, 'threshold' => (int) $r->low_stock_threshold])
            ->all();

        $shipments = DB::table('shipments')
            ->where('store_id', $storeId)
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $pipeline = [];
        foreach (['pending_pickup', 'picked_up', 'in_transit', 'delivered', 'failed_delivery', 'returned_to_seller'] as $status) {
            $pipeline[] = ['status' => $status, 'count' => (int) ($shipments[$status] ?? 0)];
        }

        return ApiResponse::success([
            'days' => $days,
            'currency_code' => $currency,
            'kpis' => [
                'revenue' => $kpi($revenueNow, $revenueBefore, true),
                'orders' => $kpi($ordersNow, $ordersBefore, false),
                'average_order_value' => $kpi($aovNow, $aovBefore, true),
                'new_customers' => $kpi($newCustomers($periodStart, null), $newCustomers($previousStart, $periodStart), false),
                'cancellation_rate' => $allInPeriod > 0 ? round($cancelled / $allInPeriod * 100, 1) : 0.0,
                'repeat_customer_rate' => $current->pluck('customer_id')->unique()->count() > 0
                    ? round($current->groupBy('customer_id')->filter(fn ($g) => $g->count() > 1)->count() / $current->pluck('customer_id')->unique()->count() * 100, 1)
                    : 0.0,
            ],
            'top_products' => $topProducts,
            'sales_by_category' => $byCategory,
            'payment_methods' => $paymentMix,
            'order_sources' => $sourceMix,
            'orders_by_weekday' => $weekday,
            'orders_by_hour' => $hourly,
            'low_stock' => $lowStock,
            'shipment_pipeline' => $pipeline,
        ], 'Dashboard insights fetched successfully.');
    }
}
