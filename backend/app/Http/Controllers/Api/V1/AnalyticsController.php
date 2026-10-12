<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use App\Models\Product;
use App\Models\Store;
use App\Support\ApiResponse;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Phase 20 — behavioral/traffic analytics fed by `analytics_events`
 * (Storefront\AnalyticsController::track()), distinct from Phase 18's
 * Reporting, which aggregates the transactional tables (orders/order_items)
 * directly. `customers()` below is the one exception that still reads
 * straight from `orders`/`customers` rather than an event — "new vs
 * returning" is order-shaped data Reporting's own conventions already
 * cover, not a behavior `analytics_events` needs to duplicate.
 */
class AnalyticsController extends Controller
{
    private const STAGES = ['product_view', 'add_to_cart', 'checkout_start', 'purchase'];

    public function overview(Request $request): JsonResponse
    {
        if (! $request->user()->can('analytics.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);

        $totals = $this->totals($data);
        $dayRows = $this->dailyTrafficRows($data);
        $byPeriod = $this->foldTrafficByGranularity($dayRows, $data['granularity']);

        $previousRange = $this->previousPeriodRange($data);
        $previousTotals = $this->totals($previousRange);

        return ApiResponse::success([
            'totals' => $this->totalsPayload($totals),
            'by_period' => $byPeriod,
            'comparison' => [
                'date_from' => $previousRange['date_from']->toDateString(),
                'date_to' => $previousRange['date_to']->toDateString(),
                'totals' => $this->totalsPayload($previousTotals),
            ],
        ], 'Analytics overview fetched successfully.');
    }

    /**
     * Behaviour detail behind the overview numbers: busiest pages, when
     * visitors arrive, how engaged they are (bounce rate, pages per
     * session), new vs returning visitors, where carts and checkouts are
     * abandoned, and the sales the storefront tracked. Everything is
     * derived from analytics_events only.
     */
    public function overviewInsights(Request $request): JsonResponse
    {
        if (! $request->user()->can('analytics.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);

        $events = DB::table('analytics_events')
            ->where('store_id', $data['store_id'])
            ->whereBetween('created_at', [$data['date_from'], $data['date_to']])
            ->select(['session_id', 'event_type', 'path', 'metadata', 'created_at']);

        $pages = [];
        $sessions = [];
        $weekday = array_fill(0, 7, 0);
        $hour = array_fill(0, 24, 0);
        $revenue = 0.0;
        $purchaseCount = 0;

        foreach ($events->cursor() as $event) {
            $sid = $event->session_id;
            $sessions[$sid] ??= ['events' => 0, 'page_views' => 0, 'cart' => false, 'checkout' => false, 'purchase' => false];
            $sessions[$sid]['events']++;

            if ($event->event_type === 'page_view') {
                $sessions[$sid]['page_views']++;
                $path = $this->normalisePath((string) $event->path);
                $pages[$path] = ($pages[$path] ?? 0) + 1;

                $at = Carbon::parse($event->created_at);
                $weekday[$at->dayOfWeek]++;
                $hour[$at->hour]++;
            } elseif ($event->event_type === 'add_to_cart') {
                $sessions[$sid]['cart'] = true;
            } elseif ($event->event_type === 'checkout_start') {
                $sessions[$sid]['checkout'] = true;
            } elseif ($event->event_type === 'purchase') {
                $sessions[$sid]['purchase'] = true;
                $purchaseCount++;
                $meta = is_string($event->metadata) ? json_decode($event->metadata, true) : null;
                $revenue += (float) ($meta['total_amount'] ?? 0);
            }
        }

        $totalSessions = count($sessions);
        $bounced = collect($sessions)->filter(fn ($s) => $s['events'] <= 1)->count();
        $pageViews = array_sum(array_column($sessions, 'page_views'));
        $withCart = collect($sessions)->filter(fn ($s) => $s['cart'])->count();
        $cartAbandoned = collect($sessions)->filter(fn ($s) => $s['cart'] && ! $s['purchase'])->count();
        $withCheckout = collect($sessions)->filter(fn ($s) => $s['checkout'])->count();
        $checkoutAbandoned = collect($sessions)->filter(fn ($s) => $s['checkout'] && ! $s['purchase'])->count();

        $returning = 0;
        if ($totalSessions > 0) {
            $seenBefore = DB::table('analytics_events')
                ->where('store_id', $data['store_id'])
                ->where('created_at', '<', $data['date_from'])
                ->whereIn('session_id', array_slice(array_keys($sessions), 0, 5000))
                ->distinct()
                ->count('session_id');
            $returning = min($seenBefore, $totalSessions);
        }

        arsort($pages);
        $topPages = collect($pages)->take(10)->map(fn ($views, $path) => ['path' => $path, 'views' => $views])->values()->all();

        $names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        $percent = fn (int $part, int $whole) => $whole > 0 ? round($part / $whole * 100, 1) : 0.0;

        return ApiResponse::success([
            'engagement' => [
                'bounce_rate' => $percent($bounced, $totalSessions),
                'pages_per_session' => $totalSessions > 0 ? round($pageViews / $totalSessions, 2) : 0.0,
                'events_per_session' => $totalSessions > 0 ? round(array_sum(array_column($sessions, 'events')) / $totalSessions, 2) : 0.0,
                'returning_visitor_rate' => $percent($returning, $totalSessions),
            ],
            'visitors' => [
                ['label' => 'New visitors', 'sessions' => max($totalSessions - $returning, 0)],
                ['label' => 'Returning visitors', 'sessions' => $returning],
            ],
            'abandonment' => [
                'cart_sessions' => $withCart,
                'cart_abandonment_rate' => $percent($cartAbandoned, $withCart),
                'checkout_sessions' => $withCheckout,
                'checkout_abandonment_rate' => $percent($checkoutAbandoned, $withCheckout),
            ],
            'sales' => [
                'purchases' => $purchaseCount,
                'revenue' => round($revenue, 2),
                'average_order_value' => $purchaseCount > 0 ? round($revenue / $purchaseCount, 2) : 0.0,
            ],
            'top_pages' => $topPages,
            'by_weekday' => collect($weekday)->map(fn ($v, $d) => ['day' => $names[$d], 'page_views' => $v])->values()->all(),
            'by_hour' => collect($hour)->map(fn ($v, $h) => ['hour' => sprintf('%02d:00', $h), 'page_views' => $v])->values()->all(),
        ], 'Analytics insights fetched successfully.');
    }

    /** Groups /products/some-slug?utm=1 and /products/some-slug/ under one key; keeps the path readable. */
    private function normalisePath(string $path): string
    {
        $path = strtok($path, '?#') ?: '/';

        return '/'.trim($path, '/');
    }

    public function overviewExport(Request $request): StreamedResponse
    {
        if (! $request->user()->can('analytics.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);
        $byPeriod = $this->foldTrafficByGranularity($this->dailyTrafficRows($data), $data['granularity']);

        return response()->streamDownload(function () use ($byPeriod) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Date', 'Page Views', 'Unique Sessions']);
            foreach ($byPeriod as $row) {
                fputcsv($handle, [$row['date'], $row['page_views'], $row['unique_sessions']]);
            }
            fclose($handle);
        }, 'analytics-overview-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    public function overviewExportPdf(Request $request): Response
    {
        if (! $request->user()->can('analytics.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);
        $totals = $this->totalsPayload($this->totals($data));
        $byPeriod = $this->foldTrafficByGranularity($this->dailyTrafficRows($data), $data['granularity']);

        $previousRange = $this->previousPeriodRange($data);
        $previousTotals = $this->totalsPayload($this->totals($previousRange));

        $pdf = Pdf::loadView('reports.analytics-overview-pdf', [
            'storeName' => Store::find($data['store_id'])?->name ?? 'Store',
            'subtitle' => sprintf(
                '%s to %s · vs. previous period (%s to %s)',
                $data['date_from']->toDateString(),
                $data['date_to']->toDateString(),
                $previousRange['date_from']->toDateString(),
                $previousRange['date_to']->toDateString(),
            ),
            'generatedAt' => now()->format('Y-m-d H:i'),
            'totals' => $totals,
            'pageViewsTrend' => $this->trendLabel($totals['page_views'], $previousTotals['page_views']),
            'sessionsTrend' => $this->trendLabel($totals['unique_sessions'], $previousTotals['unique_sessions']),
            'conversionTrend' => $this->trendLabel($totals['conversion_rate'], $previousTotals['conversion_rate']),
            'byPeriod' => $byPeriod,
        ])->setPaper('a4');

        return $pdf->download('analytics-overview-'.now()->format('Ymd-His').'.pdf');
    }

    /** Top viewed products, with each row's own view-to-cart rate — a merchandising signal Reporting's product-performance report (real sales) doesn't carry, since a product can be popular to browse without converting. */
    public function products(Request $request): JsonResponse
    {
        if (! $request->user()->can('analytics.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);
        $perPage = min((int) $request->integer('per_page', 20), 100);

        $rows = $this->productViewsQuery($data)->paginate($perPage);

        return ApiResponse::success(
            collect($rows->items())->map(fn ($row) => $this->productRow($row)),
            'Product analytics fetched successfully.',
            [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ],
        );
    }

    public function productsExport(Request $request): StreamedResponse
    {
        if (! $request->user()->can('analytics.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);
        $rows = $this->productViewsQuery($data)->get()->map(fn ($row) => $this->productRow($row));

        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Product', 'SKU', 'Views', 'Added to Cart', 'View-to-Cart Rate (%)']);
            foreach ($rows as $row) {
                fputcsv($handle, [$row['name'], $row['sku'], $row['view_count'], $row['add_to_cart_count'], $row['view_to_cart_rate']]);
            }
            fclose($handle);
        }, 'analytics-products-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    /** Zero-result searches are the single most actionable row here — real demand for something the catalog can't currently answer. */
    public function searches(Request $request): JsonResponse
    {
        if (! $request->user()->can('analytics.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);
        $perPage = min((int) $request->integer('per_page', 20), 100);
        $page = max((int) $request->integer('page', 1), 1);

        $grouped = $this->groupedSearchRows($data);
        $paged = $grouped->slice(($page - 1) * $perPage, $perPage)->values();
        $paginator = new LengthAwarePaginator($paged, $grouped->count(), $perPage, $page);

        return ApiResponse::success($paged->all(), 'Search analytics fetched successfully.', [
            'current_page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
        ]);
    }

    public function searchesExport(Request $request): StreamedResponse
    {
        if (! $request->user()->can('analytics.view')) {
            throw new AuthorizationException;
        }

        $rows = $this->groupedSearchRows($this->resolveFilters($request));

        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Search Term', 'Searches', 'Avg Results', 'Zero Results']);
            foreach ($rows as $row) {
                fputcsv($handle, [
                    $row['query'], $row['search_count'],
                    $row['avg_results_count'] ?? 'n/a',
                    $row['zero_results'] ? 'Yes' : 'No',
                ]);
            }
            fclose($handle);
        }, 'analytics-searches-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    /** Unique sessions reaching each stage, product_view through purchase — a single small summary object, not a paginated/exportable report, same reasoning DashboardController's widgets never got exports either. */
    public function funnel(Request $request): JsonResponse
    {
        if (! $request->user()->can('analytics.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);

        $stages = [];
        $previousCount = null;
        foreach (self::STAGES as $stage) {
            $count = (int) DB::table('analytics_events')
                ->where('store_id', $data['store_id'])
                ->where('event_type', $stage)
                ->whereBetween('created_at', [$data['date_from'], $data['date_to']])
                ->distinct()
                ->count('session_id');

            $stages[] = [
                'stage' => $stage,
                'sessions' => $count,
                'conversion_from_previous' => $previousCount === null
                    ? null
                    : ($previousCount > 0 ? round(($count / $previousCount) * 100, 1) : 0.0),
            ];
            $previousCount = $count;
        }

        return ApiResponse::success(['stages' => $stages], 'Conversion funnel fetched successfully.');
    }

    /** Pure `orders`/`customers` aggregation — no analytics_events involved, same "derive it fresh from the transactional tables" reasoning ReportController::salesReport() uses. */
    public function customers(Request $request): JsonResponse
    {
        if (! $request->user()->can('analytics.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);

        $firstOrderDates = $this->firstOrderDatesByCustomer($data['store_id']);
        $byDate = $this->customerDayCounts($data, $firstOrderDates);
        $byPeriod = $this->foldCustomersByGranularity($byDate, $data['granularity']);

        $totalCustomersAllTime = $firstOrderDates->count();
        $repeatCustomers = DB::table('orders')
            ->where('store_id', $data['store_id'])
            ->where('status', '!=', 'cancelled')
            ->whereNotNull('customer_id')
            ->select('customer_id')
            ->groupBy('customer_id')
            ->havingRaw('COUNT(*) > 1')
            ->get()
            ->count();

        return ApiResponse::success([
            'totals' => [
                'new_customers' => array_sum(array_column($byDate, 'new')),
                'returning_customers' => array_sum(array_column($byDate, 'returning')),
                'repeat_purchase_rate' => $totalCustomersAllTime > 0
                    ? round(($repeatCustomers / $totalCustomersAllTime) * 100, 1)
                    : 0.0,
            ],
            'by_period' => $byPeriod,
        ], 'Customer analytics fetched successfully.');
    }

    public function customersExport(Request $request): StreamedResponse
    {
        if (! $request->user()->can('analytics.view')) {
            throw new AuthorizationException;
        }

        $data = $this->resolveFilters($request);
        $firstOrderDates = $this->firstOrderDatesByCustomer($data['store_id']);
        $byDate = $this->customerDayCounts($data, $firstOrderDates);
        $byPeriod = $this->foldCustomersByGranularity($byDate, $data['granularity']);

        return response()->streamDownload(function () use ($byPeriod) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Date', 'New Customers', 'Returning Customers']);
            foreach ($byPeriod as $row) {
                fputcsv($handle, [$row['date'], $row['new'], $row['returning']]);
            }
            fclose($handle);
        }, 'analytics-customers-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    /**
     * @return array{store_id: int, date_from: Carbon, date_to: Carbon, granularity: string}
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
            'granularity' => ['nullable', 'in:day,week,month'],
        ]);

        return [
            'store_id' => $request->integer('store_id'),
            'date_from' => Carbon::parse($request->string('date_from'))->startOfDay(),
            'date_to' => Carbon::parse($request->string('date_to'))->endOfDay(),
            'granularity' => $request->string('granularity', 'day')->toString(),
        ];
    }

    /** @return array{page_views:int, unique_sessions:int, product_views:int, searches:int, add_to_cart:int, checkout_starts:int, purchases:int, conversion_rate:float} */
    private function totals(array $data): array
    {
        $row = DB::table('analytics_events')
            ->where('store_id', $data['store_id'])
            ->whereBetween('created_at', [$data['date_from'], $data['date_to']])
            ->selectRaw(implode(', ', [
                "SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as page_views",
                'COUNT(DISTINCT session_id) as unique_sessions',
                "SUM(CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END) as product_views",
                "SUM(CASE WHEN event_type = 'search' THEN 1 ELSE 0 END) as searches",
                "SUM(CASE WHEN event_type = 'add_to_cart' THEN 1 ELSE 0 END) as add_to_cart",
                "SUM(CASE WHEN event_type = 'checkout_start' THEN 1 ELSE 0 END) as checkout_starts",
                "SUM(CASE WHEN event_type = 'purchase' THEN 1 ELSE 0 END) as purchases",
            ]))
            ->first();

        $pageViews = (int) ($row->page_views ?? 0);
        $uniqueSessions = (int) ($row->unique_sessions ?? 0);
        $purchases = (int) ($row->purchases ?? 0);

        return [
            'page_views' => $pageViews,
            'unique_sessions' => $uniqueSessions,
            'product_views' => (int) ($row->product_views ?? 0),
            'searches' => (int) ($row->searches ?? 0),
            'add_to_cart' => (int) ($row->add_to_cart ?? 0),
            'checkout_starts' => (int) ($row->checkout_starts ?? 0),
            'purchases' => $purchases,
            'conversion_rate' => $uniqueSessions > 0 ? round(($purchases / $uniqueSessions) * 100, 2) : 0.0,
        ];
    }

    /** @param array{page_views:int, unique_sessions:int, product_views:int, searches:int, add_to_cart:int, checkout_starts:int, purchases:int, conversion_rate:float} $totals */
    private function totalsPayload(array $totals): array
    {
        return $totals;
    }

    /** @return Collection<int, object{date:string, page_views:int, unique_sessions:int}> */
    private function dailyTrafficRows(array $data): Collection
    {
        return DB::table('analytics_events')
            ->where('store_id', $data['store_id'])
            ->whereBetween('created_at', [$data['date_from'], $data['date_to']])
            ->selectRaw("DATE(created_at) as date, SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as page_views, COUNT(DISTINCT session_id) as unique_sessions")
            ->groupBy('date')
            ->orderBy('date')
            ->get();
    }

    /**
     * Same day-bucket-fold-in-PHP approach as ReportController (no portable
     * cross-dialect week/month truncation). `unique_sessions` folded to
     * week/month is a sum of each day's own distinct-session count, not a
     * re-derived distinct count for the wider bucket — a session active
     * across several days in one bucket is counted once per day, the same
     * "daily actives" convention every analytics tool's own weekly/monthly
     * rollup uses.
     */
    private function foldTrafficByGranularity(Collection $dayRows, string $granularity): array
    {
        if ($granularity === 'day') {
            return $dayRows->map(fn ($row) => [
                'date' => Carbon::parse($row->date)->toDateString(),
                'page_views' => (int) $row->page_views,
                'unique_sessions' => (int) $row->unique_sessions,
            ])->values()->all();
        }

        $buckets = [];
        foreach ($dayRows as $row) {
            $date = Carbon::parse($row->date);
            $key = $granularity === 'week'
                ? $date->copy()->startOfWeek()->toDateString()
                : $date->copy()->startOfMonth()->toDateString();

            $buckets[$key] ??= ['page_views' => 0, 'unique_sessions' => 0];
            $buckets[$key]['page_views'] += (int) $row->page_views;
            $buckets[$key]['unique_sessions'] += (int) $row->unique_sessions;
        }

        ksort($buckets);

        return collect($buckets)->map(fn ($bucket, $date) => [
            'date' => $date,
            'page_views' => $bucket['page_views'],
            'unique_sessions' => $bucket['unique_sessions'],
        ])->values()->all();
    }

    /** @return array{store_id: int, date_from: Carbon, date_to: Carbon, granularity: string} */
    private function previousPeriodRange(array $data): array
    {
        $durationDays = $data['date_from']->diffInDays($data['date_to']->copy()->startOfDay()) + 1;
        $previousTo = $data['date_from']->copy()->subDay()->endOfDay();
        $previousFrom = $previousTo->copy()->subDays($durationDays - 1)->startOfDay();

        return [...$data, 'date_from' => $previousFrom, 'date_to' => $previousTo];
    }

    private function trendLabel(float $current, float $previous): array
    {
        if ($previous == 0.0) {
            return $current == 0.0
                ? ['direction' => 'flat', 'label' => 'No activity vs previous period']
                : ['direction' => 'up', 'label' => 'New vs previous period'];
        }

        $percent = (($current - $previous) / $previous) * 100;
        $direction = $percent > 0 ? 'up' : ($percent < 0 ? 'down' : 'flat');
        $sign = $percent > 0 ? '+' : '';

        return ['direction' => $direction, 'label' => sprintf('%s%.1f%% vs previous period', $sign, $percent)];
    }

    private function productViewsQuery(array $data)
    {
        return DB::table('analytics_events')
            ->join('products', 'products.id', '=', 'analytics_events.entity_id')
            ->where('analytics_events.store_id', $data['store_id'])
            ->where('analytics_events.entity_type', Product::class)
            ->whereIn('analytics_events.event_type', ['product_view', 'add_to_cart'])
            ->whereBetween('analytics_events.created_at', [$data['date_from'], $data['date_to']])
            ->selectRaw("products.id as product_id, products.name, products.sku, SUM(CASE WHEN analytics_events.event_type = 'product_view' THEN 1 ELSE 0 END) as view_count, SUM(CASE WHEN analytics_events.event_type = 'add_to_cart' THEN 1 ELSE 0 END) as add_to_cart_count")
            ->groupBy('products.id', 'products.name', 'products.sku')
            ->orderByDesc('view_count');
    }

    private function productRow(object $row): array
    {
        $viewCount = (int) $row->view_count;
        $addToCartCount = (int) $row->add_to_cart_count;

        return [
            'product_id' => (int) $row->product_id,
            'name' => $row->name,
            'sku' => $row->sku,
            'view_count' => $viewCount,
            'add_to_cart_count' => $addToCartCount,
            'view_to_cart_rate' => $viewCount > 0 ? round(($addToCartCount / $viewCount) * 100, 1) : 0.0,
        ];
    }

    /**
     * Grouped in PHP over already-fetched rows, same reasoning as
     * ReportController::foldByGranularity — `metadata->>'$.query'` has no
     * single portable aggregate syntax across MySQL/SQLite (the test
     * suite's driver), so this reads the (bounded, date-ranged) raw search
     * events once and groups/aggregates with collection methods instead of
     * fighting cross-dialect JSON SQL for a report this size.
     *
     * @return Collection<int, array{query:string, search_count:int, avg_results_count: float|null, zero_results: bool}>
     */
    private function groupedSearchRows(array $data): Collection
    {
        return AnalyticsEvent::query()
            ->where('store_id', $data['store_id'])
            ->where('event_type', 'search')
            ->whereBetween('created_at', [$data['date_from'], $data['date_to']])
            ->get(['metadata'])
            ->map(fn ($event) => [
                'query' => mb_strtolower(trim((string) ($event->metadata['query'] ?? ''))),
                'results_count' => $event->metadata['results_count'] ?? null,
            ])
            ->filter(fn ($row) => $row['query'] !== '')
            ->groupBy('query')
            ->map(function ($rows, $query) {
                $resultsCounts = $rows->pluck('results_count')->filter(fn ($value) => $value !== null);

                return [
                    'query' => $query,
                    'search_count' => $rows->count(),
                    'avg_results_count' => $resultsCounts->isNotEmpty() ? round($resultsCounts->avg(), 1) : null,
                    'zero_results' => $resultsCounts->isNotEmpty() && (int) $resultsCounts->max() === 0,
                ];
            })
            ->sortByDesc('search_count')
            ->values();
    }

    /** @return Collection<int, string> customer_id => first ever order's created_at */
    private function firstOrderDatesByCustomer(int $storeId): Collection
    {
        return DB::table('orders')
            ->where('store_id', $storeId)
            ->where('status', '!=', 'cancelled')
            ->whereNotNull('customer_id')
            ->selectRaw('customer_id, MIN(created_at) as first_order_at')
            ->groupBy('customer_id')
            ->pluck('first_order_at', 'customer_id');
    }

    /**
     * Every order in range, classified new/returning against each
     * customer's all-time first order date (not just their first order
     * within this range — a customer whose real first order predates the
     * report window is "returning" here even if this is their first order
     * the report can see).
     *
     * @param  Collection<int, string>  $firstOrderDates
     * @return array<string, array{new:int, returning:int}>
     */
    private function customerDayCounts(array $data, Collection $firstOrderDates): array
    {
        $orderRows = DB::table('orders')
            ->where('store_id', $data['store_id'])
            ->where('status', '!=', 'cancelled')
            ->whereNotNull('customer_id')
            ->whereBetween('created_at', [$data['date_from'], $data['date_to']])
            ->select('customer_id', 'created_at')
            ->get();

        $byDate = [];
        foreach ($orderRows as $row) {
            $date = Carbon::parse($row->created_at)->toDateString();
            $firstOrderAt = $firstOrderDates->get($row->customer_id);
            $isNew = $firstOrderAt && Carbon::parse($firstOrderAt)->toDateString() === $date;

            $byDate[$date] ??= ['new' => 0, 'returning' => 0];
            $byDate[$date][$isNew ? 'new' : 'returning']++;
        }
        ksort($byDate);

        return $byDate;
    }

    /** @param array<string, array{new:int, returning:int}> $byDate */
    private function foldCustomersByGranularity(array $byDate, string $granularity): array
    {
        if ($granularity === 'day') {
            return collect($byDate)->map(fn ($counts, $date) => [
                'date' => $date, 'new' => $counts['new'], 'returning' => $counts['returning'],
            ])->values()->all();
        }

        $buckets = [];
        foreach ($byDate as $date => $counts) {
            $parsed = Carbon::parse($date);
            $key = $granularity === 'week'
                ? $parsed->copy()->startOfWeek()->toDateString()
                : $parsed->copy()->startOfMonth()->toDateString();

            $buckets[$key] ??= ['new' => 0, 'returning' => 0];
            $buckets[$key]['new'] += $counts['new'];
            $buckets[$key]['returning'] += $counts['returning'];
        }

        ksort($buckets);

        return collect($buckets)->map(fn ($counts, $date) => [
            'date' => $date, 'new' => $counts['new'], 'returning' => $counts['returning'],
        ])->values()->all();
    }
}
