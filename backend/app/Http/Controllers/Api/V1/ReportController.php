<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Models\Warehouse;
use App\Support\ApiResponse;
use App\Support\Money;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Phase 18 Wave 1 — activates the `reports.view` permission the RBAC
 * seeder has carried since Phase 3 but no controller checked yet. Every
 * report here is a pure read-side aggregate over already-existing tables
 * (orders/order_items/products/stock_levels) — no materialized/scheduled
 * aggregate table, same "compute it fresh" reasoning as
 * DashboardController, until a real data volume makes that too slow (see
 * DATABASE_DESIGN.md section 2's Reporting/Analytics bullet).
 */
class ReportController extends Controller
{
    /** No lead-time concept exists anywhere in the app yet (no supplier/product field for it) — a fixed assumption, same "don't build ahead of a real input" call as everywhere else, revisit if a real per-supplier lead time ever gets tracked. */
    private const REORDER_LEAD_TIME_DAYS = 14;

    public function salesReport(Request $request): JsonResponse
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);
        $currencyCode = Store::find($data['store_id'])?->currency?->code ?? 'BDT';

        $dayRows = $this->dailySalesRows($data);
        $byPeriod = $this->foldByGranularity($dayRows, $data['granularity'], $currencyCode);
        $totals = $this->periodTotals($dayRows);

        $previousRange = $this->previousPeriodRange($data);
        $previousTotals = $this->periodTotals($this->dailySalesRows($previousRange));

        $byPaymentMethod = $this->paymentMethodQuery($data)->get()->map(fn ($row) => [
            'payment_method' => $row->payment_method,
            'orders_count' => (int) $row->orders_count,
            'revenue_amount' => (new Money((int) $row->revenue_minor, $currencyCode))->toDecimal(),
        ]);

        $byCourier = $this->courierQuery($data)->get()->map(fn ($row) => [
            'courier_id' => (int) $row->courier_id,
            'courier_name' => $row->courier_name,
            'orders_count' => (int) $row->orders_count,
            'revenue_amount' => (new Money((int) $row->revenue_minor, $currencyCode))->toDecimal(),
        ]);

        return ApiResponse::success([
            'totals' => [
                'revenue_amount' => (new Money($totals['revenueMinor'], $currencyCode))->toDecimal(),
                'orders_count' => $totals['ordersCount'],
                'average_order_value' => (new Money($totals['averageMinor'], $currencyCode))->toDecimal(),
            ],
            'by_period' => $byPeriod,
            'by_payment_method' => $byPaymentMethod,
            'by_courier' => $byCourier,
            'comparison' => [
                'date_from' => $previousRange['date_from']->toDateString(),
                'date_to' => $previousRange['date_to']->toDateString(),
                'totals' => [
                    'revenue_amount' => (new Money($previousTotals['revenueMinor'], $currencyCode))->toDecimal(),
                    'orders_count' => $previousTotals['ordersCount'],
                    'average_order_value' => (new Money($previousTotals['averageMinor'], $currencyCode))->toDecimal(),
                ],
            ],
        ], 'Sales report fetched successfully.');
    }

    public function salesReportExport(Request $request): StreamedResponse
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);
        $currencyCode = Store::find($data['store_id'])?->currency?->code ?? 'BDT';
        $byPeriod = $this->foldByGranularity($this->dailySalesRows($data), $data['granularity'], $currencyCode);

        return response()->streamDownload(function () use ($byPeriod) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Date', 'Orders', 'Revenue']);
            foreach ($byPeriod as $row) {
                fputcsv($handle, [$row['date'], $row['orders_count'], $row['revenue_amount']]);
            }
            fclose($handle);
        }, 'sales-report-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    /** Richer than the CSV twin on purpose — a PDF is a presentable, shareable snapshot of the whole page, not a spreadsheet-analysis export, so it includes the KPI totals, the vs.-previous-period trend, and the payment-method/courier breakdowns the CSV deliberately leaves out. */
    public function salesReportExportPdf(Request $request): Response
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);
        $currencyCode = Store::find($data['store_id'])?->currency?->code ?? 'BDT';

        $dayRows = $this->dailySalesRows($data);
        $byPeriod = $this->foldByGranularity($dayRows, $data['granularity'], $currencyCode);
        $totals = $this->periodTotals($dayRows);

        $previousRange = $this->previousPeriodRange($data);
        $previousTotals = $this->periodTotals($this->dailySalesRows($previousRange));

        $byPaymentMethod = $this->paymentMethodQuery($data)->get()->map(fn ($row) => [
            'payment_method' => $row->payment_method,
            'orders_count' => (int) $row->orders_count,
            'revenue_amount' => (new Money((int) $row->revenue_minor, $currencyCode))->toDecimal(),
        ]);

        $byCourier = $this->courierQuery($data)->get()->map(fn ($row) => [
            'courier_name' => $row->courier_name,
            'orders_count' => (int) $row->orders_count,
            'revenue_amount' => (new Money((int) $row->revenue_minor, $currencyCode))->toDecimal(),
        ]);

        $revenueAmount = (new Money($totals['revenueMinor'], $currencyCode))->toDecimal();
        $averageOrderValue = (new Money($totals['averageMinor'], $currencyCode))->toDecimal();
        $previousRevenue = (new Money($previousTotals['revenueMinor'], $currencyCode))->toDecimal();
        $previousAverage = (new Money($previousTotals['averageMinor'], $currencyCode))->toDecimal();

        $pdf = Pdf::loadView('reports.sales-pdf', [
            'storeName' => Store::find($data['store_id'])?->name ?? 'Store',
            'currencyCode' => $currencyCode,
            'subtitle' => sprintf(
                '%s to %s · %s · vs. previous period (%s to %s)',
                $data['date_from']->toDateString(),
                $data['date_to']->toDateString(),
                $this->warehouseName($data['warehouse_id']),
                $previousRange['date_from']->toDateString(),
                $previousRange['date_to']->toDateString(),
            ),
            'generatedAt' => now()->format('Y-m-d H:i'),
            'totals' => [
                'revenue_amount' => $revenueAmount,
                'orders_count' => $totals['ordersCount'],
                'average_order_value' => $averageOrderValue,
            ],
            'revenueTrend' => $this->trendLabel($revenueAmount, $previousRevenue),
            'ordersTrend' => $this->trendLabel($totals['ordersCount'], $previousTotals['ordersCount']),
            'aovTrend' => $this->trendLabel($averageOrderValue, $previousAverage),
            'byPeriod' => $byPeriod,
            'byPaymentMethod' => $byPaymentMethod,
            'byCourier' => $byCourier,
        ])->setPaper('a4');

        return $pdf->download('sales-report-'.now()->format('Ymd-His').'.pdf');
    }

    /** Rolls a variable product's variant sales up into one row — a merchandising view of "how did this product do," not a per-variant breakdown (that lives on the product's own Variants tab). */
    public function productPerformance(Request $request): JsonResponse
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);
        $currencyCode = Store::find($data['store_id'])?->currency?->code ?? 'BDT';
        $perPage = min((int) $request->integer('per_page', 20), 100);

        $rows = $this->productPerformanceQuery($data)->paginate($perPage);

        return ApiResponse::success(
            collect($rows->items())->map(fn ($row) => [
                'product_id' => $row->product_id,
                'name' => $row->name,
                'sku' => $row->sku,
                'units_sold' => (int) $row->units_sold,
                'revenue_amount' => (new Money((int) $row->revenue_minor, $currencyCode))->toDecimal(),
            ]),
            'Product performance fetched successfully.',
            [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        );
    }

    public function productPerformanceExport(Request $request): StreamedResponse
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);
        $currencyCode = Store::find($data['store_id'])?->currency?->code ?? 'BDT';
        $rows = $this->productPerformanceQuery($data)->get();

        return response()->streamDownload(function () use ($rows, $currencyCode) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Product', 'SKU', 'Units Sold', 'Revenue']);
            foreach ($rows as $row) {
                fputcsv($handle, [
                    $row->name,
                    $row->sku,
                    $row->units_sold,
                    (new Money((int) $row->revenue_minor, $currencyCode))->toDecimal(),
                ]);
            }
            fclose($handle);
        }, 'product-performance-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    public function productPerformanceExportPdf(Request $request): Response
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);
        $currencyCode = Store::find($data['store_id'])?->currency?->code ?? 'BDT';

        $rows = $this->productPerformanceQuery($data)->get()->map(fn ($row) => [
            'name' => $row->name,
            'sku' => $row->sku,
            'units_sold' => (int) $row->units_sold,
            'revenue_amount' => (new Money((int) $row->revenue_minor, $currencyCode))->toDecimal(),
        ]);

        $pdf = Pdf::loadView('reports.product-performance-pdf', [
            'storeName' => Store::find($data['store_id'])?->name ?? 'Store',
            'currencyCode' => $currencyCode,
            'subtitle' => sprintf(
                '%s to %s · %s',
                $data['date_from']->toDateString(),
                $data['date_to']->toDateString(),
                $this->warehouseName($data['warehouse_id']),
            ),
            'generatedAt' => now()->format('Y-m-d H:i'),
            'rows' => $rows,
        ])->setPaper('a4');

        return $pdf->download('product-performance-'.now()->format('Ymd-His').'.pdf');
    }

    /** Cross-warehouse, unlike StockLevelController::index() — a low-stock product's name should surface regardless of which warehouse is short, and a variable product's variants are summed together, same convention as the Stock Levels list. */
    public function lowStock(Request $request): JsonResponse
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $request->validate(['store_id' => ['required', 'exists:stores,id']]);
        $perPage = min((int) $request->integer('per_page', 20), 100);

        $rows = $this->lowStockQuery($request->integer('store_id'))->paginate($perPage);

        return ApiResponse::success(
            collect($rows->items())->map(fn ($row) => [
                'product_id' => $row->product_id,
                'name' => $row->name,
                'sku' => $row->sku,
                'total_quantity' => (int) $row->total_quantity,
                'total_reserved' => (int) $row->total_reserved,
                'total_available' => (int) $row->total_quantity - (int) $row->total_reserved,
                'low_stock_threshold' => (int) $row->low_stock_threshold,
            ]),
            'Low stock report fetched successfully.',
            [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        );
    }

    public function lowStockExport(Request $request): StreamedResponse
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $request->validate(['store_id' => ['required', 'exists:stores,id']]);
        $rows = $this->lowStockQuery($request->integer('store_id'))->get();

        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Product', 'SKU', 'On Hand', 'Reserved', 'Available', 'Threshold']);
            foreach ($rows as $row) {
                fputcsv($handle, [
                    $row->name,
                    $row->sku,
                    $row->total_quantity,
                    $row->total_reserved,
                    (int) $row->total_quantity - (int) $row->total_reserved,
                    $row->low_stock_threshold,
                ]);
            }
            fclose($handle);
        }, 'low-stock-report-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    public function lowStockExportPdf(Request $request): Response
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $request->validate(['store_id' => ['required', 'exists:stores,id']]);
        $storeId = $request->integer('store_id');

        $rows = $this->lowStockQuery($storeId)->get()->map(fn ($row) => [
            'name' => $row->name,
            'sku' => $row->sku,
            'total_quantity' => (int) $row->total_quantity,
            'total_reserved' => (int) $row->total_reserved,
            'low_stock_threshold' => (int) $row->low_stock_threshold,
        ]);

        $pdf = Pdf::loadView('reports.low-stock-pdf', [
            'storeName' => Store::find($storeId)?->name ?? 'Store',
            'subtitle' => 'As of '.now()->format('Y-m-d H:i'),
            'generatedAt' => now()->format('Y-m-d H:i'),
            'rows' => $rows,
        ])->setPaper('a4');

        return $pdf->download('low-stock-report-'.now()->format('Ymd-His').'.pdf');
    }

    /**
     * Every low-stock product (same query as lowStock() above), enriched with
     * a 30-day sales velocity and its most recent purchase — the two inputs
     * Phase 6's own note said this report was blocked on until Reporting
     * (Phase 18) and Analytics (Phase 20) existed to compute them from.
     * Suggested quantity = enough to clear the threshold deficit, plus
     * enough to cover REORDER_LEAD_TIME_DAYS of average demand.
     */
    public function reorderSuggestions(Request $request): JsonResponse
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $request->validate(['store_id' => ['required', 'exists:stores,id']]);
        $perPage = min((int) $request->integer('per_page', 20), 100);
        $page = max((int) $request->integer('page', 1), 1);

        $rows = $this->reorderSuggestionsRows($request->integer('store_id'));

        return ApiResponse::success(
            $rows->forPage($page, $perPage)->values(),
            'Reorder suggestions fetched successfully.',
            [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $rows->count(),
                'last_page' => max((int) ceil($rows->count() / $perPage), 1),
            ],
        );
    }

    public function reorderSuggestionsExport(Request $request): StreamedResponse
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $request->validate(['store_id' => ['required', 'exists:stores,id']]);
        $rows = $this->reorderSuggestionsRows($request->integer('store_id'));

        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Product', 'SKU', 'Available', 'Threshold', 'Avg Daily Sales', 'Suggested Reorder Qty', 'Last Supplier', 'Last Unit Cost']);
            foreach ($rows as $row) {
                fputcsv($handle, [
                    $row['name'], $row['sku'], $row['available_quantity'], $row['low_stock_threshold'],
                    $row['avg_daily_sales'], $row['suggested_reorder_quantity'],
                    $row['last_supplier']['name'] ?? '', $row['last_unit_cost'] ?? '',
                ]);
            }
            fclose($handle);
        }, 'reorder-suggestions-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    public function reorderSuggestionsExportPdf(Request $request): Response
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $request->validate(['store_id' => ['required', 'exists:stores,id']]);
        $storeId = $request->integer('store_id');

        $pdf = Pdf::loadView('reports.reorder-suggestions-pdf', [
            'storeName' => Store::find($storeId)?->name ?? 'Store',
            'subtitle' => 'As of '.now()->format('Y-m-d H:i').' · based on the last 30 days of sales',
            'generatedAt' => now()->format('Y-m-d H:i'),
            'rows' => $this->reorderSuggestionsRows($storeId),
        ])->setPaper('a4', 'landscape');

        return $pdf->download('reorder-suggestions-'.now()->format('Ymd-His').'.pdf');
    }

    /**
     * @return array{store_id: int, date_from: Carbon, date_to: Carbon, warehouse_id: ?int, granularity: string}
     */
    private function resolveFilters(Request $request): array
    {
        $request->validate([
            'store_id' => ['required', 'exists:stores,id'],
            'date_from' => ['required', 'date'],
            'date_to' => [
                'required', 'date', 'after_or_equal:date_from',
                function ($attribute, $value, $fail) use ($request) {
                    if (Carbon::parse($request->input('date_from'))->diffInDays(Carbon::parse($value)) > 366) {
                        $fail('The date range cannot exceed 366 days.');
                    }
                },
            ],
            'warehouse_id' => ['nullable', 'exists:warehouses,id'],
            'granularity' => ['nullable', Rule::in(['day', 'week', 'month'])],
        ]);

        return [
            'store_id' => $request->integer('store_id'),
            'date_from' => Carbon::parse($request->string('date_from'))->startOfDay(),
            'date_to' => Carbon::parse($request->string('date_to'))->endOfDay(),
            'warehouse_id' => $request->filled('warehouse_id') ? $request->integer('warehouse_id') : null,
            'granularity' => $request->string('granularity', 'day')->toString(),
        ];
    }

    /**
     * Context around the sales report's headline numbers: where revenue
     * came from (category, customer, weekday), what discounts and shipping
     * did, how orders ended up, and how many buyers were new. Revenue is
     * line items on non-cancelled orders, matching salesReport().
     */
    public function salesInsights(Request $request): JsonResponse
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);
        $currency = Store::find($data['store_id'])?->currency?->code ?? 'BDT';
        $money = fn (int|float $minor) => (new Money((int) round($minor), $currency))->toDecimal();

        $orders = fn () => DB::table('orders')
            ->where('orders.store_id', $data['store_id'])
            ->whereBetween('orders.created_at', [$data['date_from'], $data['date_to']])
            ->when($data['warehouse_id'], fn ($q) => $q->where('orders.warehouse_id', $data['warehouse_id']));

        $items = fn () => $orders()
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.status', '!=', 'cancelled');

        $dayRows = $this->dailySalesRows($data);
        $totals = $this->periodTotals($dayRows);
        $best = $dayRows->sortByDesc('revenue_minor')->first();
        $days = max(1, (int) $data['date_from']->diffInDays($data['date_to']) + 1);

        $charges = $orders()->where('status', '!=', 'cancelled')
            ->selectRaw('COALESCE(SUM(shipping_amount), 0) as shipping, COALESCE(SUM(discount_amount), 0) as discount, COALESCE(SUM(store_credit_amount), 0) as credit')
            ->first();

        $byCategory = $items()
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->groupBy('categories.name')
            ->orderByDesc(DB::raw('SUM(order_items.quantity * order_items.unit_price_amount)'))
            ->limit(8)
            ->selectRaw('categories.name as name, SUM(order_items.quantity) as units, SUM(order_items.quantity * order_items.unit_price_amount) as revenue_minor')
            ->get()
            ->map(fn ($r) => ['name' => $r->name ?? 'Uncategorised', 'units' => (int) $r->units, 'revenue_amount' => $money($r->revenue_minor)])
            ->all();

        $topCustomers = $items()
            ->join('customers', 'customers.id', '=', 'orders.customer_id')
            ->groupBy('customers.id', 'customers.name')
            ->orderByDesc(DB::raw('SUM(order_items.quantity * order_items.unit_price_amount)'))
            ->limit(5)
            ->selectRaw('customers.id, customers.name, COUNT(DISTINCT orders.id) as orders_count, SUM(order_items.quantity * order_items.unit_price_amount) as revenue_minor')
            ->get()
            ->map(fn ($r) => ['id' => $r->id, 'name' => $r->name, 'orders_count' => (int) $r->orders_count, 'revenue_amount' => $money($r->revenue_minor)])
            ->all();

        $weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        $byWeekday = array_map(fn ($d) => ['day' => $weekdayNames[$d], 'orders_count' => 0, 'revenue_amount' => 0.0], range(0, 6));
        $weekdayMinor = array_fill(0, 7, 0);
        foreach ($dayRows as $row) {
            $d = Carbon::parse($row->date)->dayOfWeek;
            $byWeekday[$d]['orders_count'] += (int) $row->orders_count;
            $weekdayMinor[$d] += (int) $row->revenue_minor;
        }
        foreach ($weekdayMinor as $d => $minor) {
            $byWeekday[$d]['revenue_amount'] = $money($minor);
        }

        $statusRows = $orders()->selectRaw('status, COUNT(*) as count')->groupBy('status')->pluck('count', 'status');
        $statusMix = [];
        foreach (['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as $status) {
            $statusMix[] = ['status' => $status, 'count' => (int) ($statusRows[$status] ?? 0)];
        }

        $buyerIds = $orders()->where('status', '!=', 'cancelled')->distinct()->pluck('customer_id');
        $returning = $buyerIds->isEmpty() ? 0 : DB::table('orders')
            ->where('store_id', $data['store_id'])
            ->where('status', '!=', 'cancelled')
            ->where('created_at', '<', $data['date_from'])
            ->whereIn('customer_id', $buyerIds->all())
            ->distinct()
            ->count('customer_id');

        $cancelled = (int) ($statusRows['cancelled'] ?? 0);
        $placed = (int) $statusRows->sum();

        return ApiResponse::success([
            'summary' => [
                'daily_average_revenue' => $money($totals['revenueMinor'] / $days),
                'best_day' => $best ? ['date' => Carbon::parse($best->date)->toDateString(), 'revenue_amount' => $money($best->revenue_minor), 'orders_count' => (int) $best->orders_count] : null,
                'shipping_collected' => $money((int) $charges->shipping),
                'discounts_given' => $money((int) $charges->discount),
                'store_credit_used' => $money((int) $charges->credit),
                'cancellation_rate' => $placed > 0 ? round($cancelled / $placed * 100, 1) : 0.0,
                'buyers' => $buyerIds->count(),
                'returning_buyers' => $returning,
                'new_buyers' => max($buyerIds->count() - $returning, 0),
            ],
            'by_category' => $byCategory,
            'top_customers' => $topCustomers,
            'by_weekday' => $byWeekday,
            'status_mix' => $statusMix,
        ], 'Sales insights fetched successfully.');
    }

    /**
     * Health of tracked stock at a glance: how many products are healthy,
     * low or out, and what the stock on hand is worth at cost and at the
     * selling price.
     */
    public function stockOverview(Request $request): JsonResponse
    {
        if (! $request->user()->can('reports.view')) {
            throw new AuthorizationException;
        }

        $request->validate(['store_id' => ['required', 'exists:stores,id']]);
        $storeId = $request->integer('store_id');
        $currency = Store::find($storeId)?->currency?->code ?? 'BDT';

        $rows = DB::table('products')
            ->leftJoin('stock_levels', 'stock_levels.product_id', '=', 'products.id')
            ->where('products.store_id', $storeId)
            ->where('products.track_stock', true)
            ->where('products.type', '!=', 'bundle')
            ->whereNull('products.deleted_at')
            ->groupBy('products.id', 'products.cost_price_amount', 'products.price_amount', 'products.low_stock_threshold')
            ->selectRaw('products.id, products.cost_price_amount, products.price_amount, products.low_stock_threshold, COALESCE(SUM(stock_levels.quantity), 0) as qty, COALESCE(SUM(stock_levels.quantity_reserved), 0) as reserved')
            ->get();

        $out = 0;
        $low = 0;
        $healthy = 0;
        $units = 0;
        $costValue = 0;
        $retailValue = 0;

        foreach ($rows as $row) {
            $qty = (int) $row->qty;
            $available = $qty - (int) $row->reserved;
            $units += max($qty, 0);
            $costValue += max($qty, 0) * (int) ($row->cost_price_amount ?? 0);
            $retailValue += max($qty, 0) * (int) $row->price_amount;

            if ($qty <= 0) {
                $out++;
            } elseif ($row->low_stock_threshold !== null && $available <= (int) $row->low_stock_threshold) {
                $low++;
            } else {
                $healthy++;
            }
        }

        $money = fn (int $minor) => (new Money($minor, $currency))->toDecimal();

        return ApiResponse::success([
            'tracked_products' => $rows->count(),
            'out_of_stock' => $out,
            'low_stock' => $low,
            'healthy' => $healthy,
            'units_on_hand' => $units,
            'stock_value_at_cost' => $money($costValue),
            'stock_value_at_retail' => $money($retailValue),
            'potential_margin' => $money($retailValue - $costValue),
        ], 'Stock overview fetched successfully.');
    }

    /** @return Collection<int, object{date: string, orders_count: int, revenue_minor: int}> */
    private function dailySalesRows(array $data): Collection
    {
        return DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.store_id', $data['store_id'])
            ->where('orders.status', '!=', 'cancelled')
            ->whereBetween('orders.created_at', [$data['date_from'], $data['date_to']])
            ->when($data['warehouse_id'], fn ($q) => $q->where('orders.warehouse_id', $data['warehouse_id']))
            ->selectRaw('DATE(orders.created_at) as date, COUNT(DISTINCT orders.id) as orders_count, SUM(order_items.quantity * order_items.unit_price_amount) as revenue_minor')
            ->groupBy('date')
            ->orderBy('date')
            ->get();
    }

    /** @return array{ordersCount: int, revenueMinor: int, averageMinor: int} */
    private function periodTotals(Collection $dayRows): array
    {
        $ordersCount = (int) $dayRows->sum('orders_count');
        $revenueMinor = (int) $dayRows->sum('revenue_minor');
        $averageMinor = $ordersCount > 0 ? intdiv($revenueMinor, $ordersCount) : 0;

        return compact('ordersCount', 'revenueMinor', 'averageMinor');
    }

    /**
     * The immediately preceding period of the same length as the requested
     * range — e.g. a 30-day selection compares against the 30 days right
     * before it, not a fixed "last calendar month" (which would be a
     * different length for most selections anyway). Same store/warehouse
     * filters as $data, so the comparison stays apples-to-apples; already
     * within the 366-day cap `resolveFilters()` enforces on the primary
     * range, so no separate validation is needed here.
     *
     * @return array{store_id: int, date_from: Carbon, date_to: Carbon, warehouse_id: ?int, granularity: string}
     */
    private function previousPeriodRange(array $data): array
    {
        // Diffed against date_to's own startOfDay, not the endOfDay instant
        // resolveFilters() stored — date_from vs. an endOfDay operand is a
        // near-whole-day fraction (23:59:59.999999) that Carbon's diffInDays
        // rounds up, silently adding a day to $durationDays.
        $durationDays = $data['date_from']->diffInDays($data['date_to']->copy()->startOfDay()) + 1;
        $previousTo = $data['date_from']->copy()->subDay()->endOfDay();
        $previousFrom = $previousTo->copy()->subDays($durationDays - 1)->startOfDay();

        return [...$data, 'date_from' => $previousFrom, 'date_to' => $previousTo];
    }

    /**
     * Grouping by week/month happens in PHP over already-fetched day
     * buckets rather than in SQL, since MySQL and SQLite (used by the test
     * suite) don't share a portable week/month truncation function —
     * DATE(orders.created_at) for the day-level query above is the only
     * date function both dialects agree on.
     */
    private function foldByGranularity(Collection $dayRows, string $granularity, string $currencyCode): array
    {
        if ($granularity === 'day') {
            return $dayRows->map(fn ($row) => [
                'date' => Carbon::parse($row->date)->toDateString(),
                'orders_count' => (int) $row->orders_count,
                'revenue_amount' => (new Money((int) $row->revenue_minor, $currencyCode))->toDecimal(),
            ])->values()->all();
        }

        $buckets = [];
        foreach ($dayRows as $row) {
            $date = Carbon::parse($row->date);
            $key = $granularity === 'week'
                ? $date->copy()->startOfWeek()->toDateString()
                : $date->copy()->startOfMonth()->toDateString();

            $buckets[$key] ??= ['orders_count' => 0, 'revenue_minor' => 0];
            $buckets[$key]['orders_count'] += $row->orders_count;
            $buckets[$key]['revenue_minor'] += $row->revenue_minor;
        }

        ksort($buckets);

        return collect($buckets)->map(fn ($bucket, $date) => [
            'date' => $date,
            'orders_count' => (int) $bucket['orders_count'],
            'revenue_amount' => (new Money((int) $bucket['revenue_minor'], $currencyCode))->toDecimal(),
        ])->values()->all();
    }

    private function paymentMethodQuery(array $data)
    {
        return DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.store_id', $data['store_id'])
            ->where('orders.status', '!=', 'cancelled')
            ->whereBetween('orders.created_at', [$data['date_from'], $data['date_to']])
            ->when($data['warehouse_id'], fn ($q) => $q->where('orders.warehouse_id', $data['warehouse_id']))
            ->selectRaw('orders.payment_method, COUNT(DISTINCT orders.id) as orders_count, SUM(order_items.quantity * order_items.unit_price_amount) as revenue_minor')
            ->groupBy('orders.payment_method');
    }

    /**
     * Inner-joined to `shipments`/`couriers` — unlike the totals/by-period/
     * by-payment-method breakdowns above, this one only covers orders that
     * actually reached a courier. An order still awaiting dispatch isn't
     * "this courier's" or any courier's yet, so it correctly drops out of
     * this breakdown while still counting in the report's overall totals;
     * the two are expected to disagree once orders are in flight.
     */
    private function courierQuery(array $data)
    {
        return DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('shipments', 'shipments.order_id', '=', 'orders.id')
            ->join('couriers', 'couriers.id', '=', 'shipments.courier_id')
            ->where('orders.store_id', $data['store_id'])
            ->where('orders.status', '!=', 'cancelled')
            ->whereBetween('orders.created_at', [$data['date_from'], $data['date_to']])
            ->when($data['warehouse_id'], fn ($q) => $q->where('orders.warehouse_id', $data['warehouse_id']))
            ->selectRaw('couriers.id as courier_id, couriers.name as courier_name, COUNT(DISTINCT orders.id) as orders_count, SUM(order_items.quantity * order_items.unit_price_amount) as revenue_minor')
            ->groupBy('couriers.id', 'couriers.name')
            ->orderByDesc('revenue_minor');
    }

    private function productPerformanceQuery(array $data)
    {
        return DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->where('orders.store_id', $data['store_id'])
            ->where('orders.status', '!=', 'cancelled')
            ->whereBetween('orders.created_at', [$data['date_from'], $data['date_to']])
            ->when($data['warehouse_id'], fn ($q) => $q->where('orders.warehouse_id', $data['warehouse_id']))
            ->selectRaw('products.id as product_id, products.name, products.sku, SUM(order_items.quantity) as units_sold, SUM(order_items.quantity * order_items.unit_price_amount) as revenue_minor')
            ->groupBy('products.id', 'products.name', 'products.sku')
            ->orderByDesc('revenue_minor');
    }

    /**
     * `track_stock = true` also happens to be what keeps a bundle out of
     * this report — ProductController forces it false on every bundle,
     * since a bundle never has stock_levels rows of its own (see
     * BundleExpander), and without that guard a bundle would show 0 on
     * hand against any positive threshold and always read as "low stock."
     */
    private function lowStockQuery(int $storeId)
    {
        return DB::table('products')
            ->leftJoin('stock_levels', 'stock_levels.product_id', '=', 'products.id')
            ->where('products.store_id', $storeId)
            ->where('products.track_stock', true)
            ->whereNotNull('products.low_stock_threshold')
            ->selectRaw('products.id as product_id, products.name, products.sku, products.low_stock_threshold, COALESCE(SUM(stock_levels.quantity), 0) as total_quantity, COALESCE(SUM(stock_levels.quantity_reserved), 0) as total_reserved')
            ->groupBy('products.id', 'products.name', 'products.sku', 'products.low_stock_threshold')
            ->havingRaw('(COALESCE(SUM(stock_levels.quantity), 0) - COALESCE(SUM(stock_levels.quantity_reserved), 0)) <= products.low_stock_threshold')
            ->orderBy('products.name');
    }

    /**
     * @return Collection<int, array{product_id: int, name: string, sku: string, available_quantity: int, low_stock_threshold: int, avg_daily_sales: float, suggested_reorder_quantity: int, last_supplier: ?array{id: int, name: string}, last_unit_cost: ?float}>
     */
    private function reorderSuggestionsRows(int $storeId): Collection
    {
        $lowStock = $this->lowStockQuery($storeId)->get();

        if ($lowStock->isEmpty()) {
            return collect();
        }

        $productIds = $lowStock->pluck('product_id');

        $velocityByProduct = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereIn('order_items.product_id', $productIds)
            ->where('orders.store_id', $storeId)
            ->where('orders.status', '!=', 'cancelled')
            ->where('orders.created_at', '>=', now()->subDays(30))
            ->selectRaw('order_items.product_id, SUM(order_items.quantity) as units_sold')
            ->groupBy('order_items.product_id')
            ->pluck('units_sold', 'product_id');

        // Most recent non-cancelled PO line per product — ordered desc then
        // deduplicated in PHP rather than a correlated subquery, the same
        // portability call foldByGranularity() makes for MySQL vs. SQLite.
        $lastPurchaseByProduct = DB::table('purchase_order_items')
            ->join('purchase_orders', 'purchase_orders.id', '=', 'purchase_order_items.purchase_order_id')
            ->join('suppliers', 'suppliers.id', '=', 'purchase_orders.supplier_id')
            ->whereIn('purchase_order_items.product_id', $productIds)
            ->where('purchase_orders.store_id', $storeId)
            ->where('purchase_orders.status', '!=', 'cancelled')
            ->orderByDesc('purchase_orders.created_at')
            ->select(
                'purchase_order_items.product_id', 'suppliers.id as supplier_id', 'suppliers.name as supplier_name',
                'purchase_order_items.unit_cost_amount', 'purchase_orders.currency_code',
            )
            ->get()
            ->unique('product_id')
            ->keyBy('product_id');

        return $lowStock->map(function ($row) use ($velocityByProduct, $lastPurchaseByProduct) {
            $available = (int) $row->total_quantity - (int) $row->total_reserved;
            $avgDailySales = round((int) ($velocityByProduct[$row->product_id] ?? 0) / 30, 2);
            $deficit = max((int) $row->low_stock_threshold - $available, 0);
            $lastPurchase = $lastPurchaseByProduct->get($row->product_id);

            return [
                'product_id' => $row->product_id,
                'name' => $row->name,
                'sku' => $row->sku,
                'available_quantity' => $available,
                'low_stock_threshold' => (int) $row->low_stock_threshold,
                'avg_daily_sales' => $avgDailySales,
                'suggested_reorder_quantity' => max($deficit + (int) ceil($avgDailySales * self::REORDER_LEAD_TIME_DAYS), 1),
                'last_supplier' => $lastPurchase ? ['id' => (int) $lastPurchase->supplier_id, 'name' => $lastPurchase->supplier_name] : null,
                'last_unit_cost' => $lastPurchase ? (new Money((int) $lastPurchase->unit_cost_amount, $lastPurchase->currency_code))->toDecimal() : null,
            ];
        });
    }

    private function warehouseName(?int $warehouseId): string
    {
        if (! $warehouseId) {
            return 'All warehouses';
        }

        return Warehouse::find($warehouseId)?->name ?? 'All warehouses';
    }

    /** Mirrors the frontend's computeTrend() (sales/page.tsx) so the PDF and the on-screen KPI cards never disagree. */
    private function trendLabel(float $current, float $previous): array
    {
        if ($previous == 0.0) {
            return $current == 0.0
                ? ['direction' => 'flat', 'label' => 'No orders vs previous period']
                : ['direction' => 'up', 'label' => 'New vs previous period'];
        }

        $percent = (($current - $previous) / $previous) * 100;
        $direction = $percent > 0 ? 'up' : ($percent < 0 ? 'down' : 'flat');
        $sign = $percent > 0 ? '+' : '';

        return ['direction' => $direction, 'label' => sprintf('%s%.1f%% vs previous period', $sign, $percent)];
    }
}
