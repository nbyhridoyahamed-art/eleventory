<?php

namespace App\Mcp;

use Illuminate\Support\Str;

/**
 * The tools the remote MCP endpoint exposes. Each one is a thin, typed
 * wrapper over an existing admin API route (see ApiBridge), so behaviour,
 * validation and permissions are identical to the dashboard.
 */
class McpTools
{
    private const SEO_KEYS = [
        'title', 'description', 'focus_keyword', 'og_title', 'og_description', 'og_image',
        'twitter_title', 'twitter_description', 'twitter_image', 'canonical_url', 'robots', 'schema_json',
    ];

    /**
     * @return array<int, array{name: string, description: string, inputSchema: array, write: bool, destructive: bool, handler: callable}>
     */
    public static function all(): array
    {
        $page = ['page' => self::int('Page number (default 1)')];
        $perPage = ['per_page' => self::int('Items per page (default 20, max 100)')];
        $paging = $page + $perPage;
        $range = ['date_from' => self::str('Start date, YYYY-MM-DD'), 'date_to' => self::str('End date, YYYY-MM-DD')];
        $granularity = ['granularity' => self::enum(['day', 'week', 'month'])];
        $confirm = ['confirm' => ['type' => 'boolean', 'description' => 'Must be true: confirms you intend this irreversible change.']];

        $productFields = [
            'name' => self::str(),
            'slug' => self::str('Lowercase letters, numbers and hyphens'),
            'sku' => self::str('Leave out to auto-generate (e.g. JOY-000123)'),
            'barcode' => self::str(),
            'type' => self::enum(['simple', 'variable', 'bundle']),
            'category_id' => self::int(),
            'brand_id' => self::int(),
            'price' => self::num('Regular price in BDT'),
            'sale_price' => self::num(),
            'cost_price' => self::num(),
            'compare_at_price' => self::num(),
            'short_description' => self::str(),
            'description' => self::str('HTML allowed (headings, links, lists); sanitised on save'),
            'status' => self::enum(['draft', 'active', 'archived']),
            'featured' => ['type' => 'boolean'],
            'track_stock' => ['type' => 'boolean'],
            'low_stock_threshold' => self::int(),
            'weight' => self::num(),
            'weight_unit' => self::enum(['kg', 'g', 'lb']),
            'stock' => [
                'type' => 'object',
                'description' => 'Set on-hand stock at one warehouse (simple products); recorded in the inventory ledger',
                'properties' => ['warehouse_id' => self::int(), 'quantity' => self::int()],
                'required' => ['warehouse_id', 'quantity'],
            ],
            'seo_title' => self::str(),
            'seo_description' => self::str(),
            'focus_keyword' => self::str(),
        ];

        return [
            // ---- overview -------------------------------------------------
            self::tool('store_overview', 'Who you are signed in as, the store being managed, and headline counts (products, open orders, low stock, open purchase orders).', [], [], function ($a, ApiBridge $api, $user) {
                $products = $api->call('GET', '/products', $api->scoped(['per_page' => 1]));
                $orders = $api->call('GET', '/orders', $api->scoped(['open' => 1, 'per_page' => 1]));
                $low = $api->get('/stock-levels/low-stock-count', $api->scoped());
                $po = $api->call('GET', '/purchase-orders', $api->scoped(['open' => 1, 'per_page' => 1]));

                return [
                    'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
                    'store_id' => $api->storeId,
                    'site' => config('app.frontend_url'),
                    'products' => $products['meta']['total'] ?? 0,
                    'open_orders' => $orders['meta']['total'] ?? 0,
                    'low_stock_alerts' => $low['count'] ?? 0,
                    'open_purchase_orders' => $po['meta']['total'] ?? 0,
                ];
            }),
            self::tool('dashboard_insights', 'Period KPIs with change vs the previous period, top products, sales by category, payment mix, order sources, delivery pipeline, weekday/hour patterns and low stock.', ['days' => self::int('Period length in days (7-90, default 30)')], [], fn ($a, $api) => $api->get('/dashboard/insights', $api->scoped(['days' => $a['days'] ?? null]))),
            self::tool('sales_trend', 'Orders and revenue per day for the last N days.', ['days' => self::int()], [], fn ($a, $api) => $api->get('/dashboard/sales-trend', $api->scoped(['days' => $a['days'] ?? null]))),

            // ---- catalog --------------------------------------------------
            self::tool('list_products', 'Search and list products. Filters: free-text search (name/SKU), status, category, brand.', ['search' => self::str(), 'status' => self::enum(['draft', 'active', 'archived']), 'category_id' => self::int(), 'brand_id' => self::int()] + $paging, [], fn ($a, $api) => $api->listing('/products', self::only($a, ['search', 'status', 'category_id', 'brand_id', 'page', 'per_page']))),
            self::tool('get_product', 'Full details of one product: pricing, stock by warehouse, images, variants, SEO and score.', ['product_id' => self::int()], ['product_id'], fn ($a, $api) => $api->get('/products/'.(int) $a['product_id'])),
            self::tool('create_product', 'Create a product. Only name and price are required; the slug and SKU are generated when omitted. New products are drafts unless status is set.', $productFields, ['name', 'price'], function ($a, ApiBridge $api) {
                $a['slug'] ??= Str::slug((string) $a['name']);

                return $api->post('/products', self::productPayload($a, [], $api));
            }, write: true),
            self::tool('update_product', 'Change fields of an existing product. Only the fields you pass are changed; everything else is kept.', ['product_id' => self::int()] + $productFields, ['product_id'], function ($a, ApiBridge $api) {
                $id = (int) $a['product_id'];
                unset($a['product_id']);
                $existing = $api->get("/products/{$id}");

                return $api->put("/products/{$id}", self::productPayload($a, $existing, $api));
            }, write: true),
            self::tool('delete_product', 'Delete a product (moves it to trash). Requires confirm=true.', ['product_id' => self::int()] + $confirm, ['product_id', 'confirm'], function ($a, ApiBridge $api) {
                self::requireConfirm($a);
                $api->delete('/products/'.(int) $a['product_id']);

                return ['deleted' => true, 'product_id' => (int) $a['product_id']];
            }, write: true, destructive: true),
            self::tool('next_sku', 'Preview the SKU a new product would get for a brand/category.', ['brand_id' => self::int(), 'category_id' => self::int()], [], fn ($a, $api) => $api->get('/products/next-sku', $api->scoped(self::only($a, ['brand_id', 'category_id'])))),
            self::tool('list_categories', 'All categories (flat list with parent_id; sub-categories reference their parent).', [], [], fn ($a, $api) => $api->get('/categories', $api->scoped())),
            self::tool('create_category', 'Create a category or sub-category (set parent_id).', ['name' => self::str(), 'slug' => self::str(), 'parent_id' => self::int(), 'description' => self::str()], ['name'], fn ($a, $api) => $api->post('/categories', [
                'store_id' => $api->storeId,
                'name' => $a['name'],
                'slug' => $a['slug'] ?? Str::slug((string) $a['name']),
                'parent_id' => $a['parent_id'] ?? null,
                'description' => $a['description'] ?? null,
                'status' => 'active',
            ]), write: true),
            self::tool('list_brands', 'List brands.', ['search' => self::str()] + $paging, [], fn ($a, $api) => $api->listing('/brands', self::only($a, ['search', 'page', 'per_page']))),
            self::tool('create_brand', 'Create a brand.', ['name' => self::str(), 'slug' => self::str(), 'description' => self::str()], ['name'], fn ($a, $api) => $api->post('/brands', [
                'store_id' => $api->storeId,
                'name' => $a['name'],
                'slug' => $a['slug'] ?? Str::slug((string) $a['name']),
                'description' => $a['description'] ?? null,
                'status' => 'active',
            ]), write: true),

            // ---- inventory ------------------------------------------------
            self::tool('list_warehouses', 'List warehouses (needed for stock operations).', [], [], fn ($a, $api) => $api->get('/warehouses', $api->scoped(['per_page' => 100]))),
            self::tool('stock_levels', 'On-hand and reserved stock per product at one warehouse.', ['warehouse_id' => self::int(), 'search' => self::str()] + $paging, ['warehouse_id'], fn ($a, $api) => $api->listing('/stock-levels', self::only($a, ['warehouse_id', 'search', 'page', 'per_page']))),
            self::tool('stock_movements', 'The inventory ledger: every increase, decrease, sale and transfer.', ['product_id' => self::int(), 'warehouse_id' => self::int()] + $paging, [], fn ($a, $api) => $api->listing('/stock-movements', self::only($a, ['product_id', 'warehouse_id', 'page', 'per_page']))),
            self::tool('adjust_stock', 'Increase or decrease on-hand stock of a product (or variant) at a warehouse. Recorded in the movements ledger.', [
                'product_id' => self::int(),
                'warehouse_id' => self::int(),
                'direction' => self::enum(['increase', 'decrease']),
                'quantity' => self::int(),
                'product_variant_id' => self::int(),
                'reason' => self::str(),
            ], ['product_id', 'warehouse_id', 'direction', 'quantity'], fn ($a, $api) => $api->post('/stock-adjustments', self::only($a, ['product_id', 'warehouse_id', 'direction', 'quantity', 'product_variant_id', 'reason'])), write: true),
            self::tool('stock_overview', 'Stock health: tracked products, out of stock, low stock, units and stock value at cost/retail.', [], [], fn ($a, $api) => $api->get('/reports/stock-overview', $api->scoped())),
            self::tool('low_stock_report', 'Products at or below their low-stock threshold.', $paging, [], fn ($a, $api) => $api->listing('/reports/low-stock', self::only($a, ['page', 'per_page']))),
            self::tool('reorder_suggestions', 'Suggested purchase quantities for products running low, with last supplier and unit cost.', $paging, [], fn ($a, $api) => $api->listing('/reports/reorder-suggestions', self::only($a, ['page', 'per_page']))),

            // ---- orders & delivery ----------------------------------------
            self::tool('list_orders', 'List orders, newest first.', ['status' => self::enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']), 'customer_id' => self::int(), 'warehouse_id' => self::int()] + $paging, [], fn ($a, $api) => $api->listing('/orders', self::only($a, ['status', 'customer_id', 'warehouse_id', 'page', 'per_page']))),
            self::tool('get_order', 'One order with items, customer, shipping address, payments, shipments and status history.', ['order_id' => self::int()], ['order_id'], fn ($a, $api) => $api->get('/orders/'.(int) $a['order_id'])),
            self::tool('process_order', 'Move a pending order to processing.', ['order_id' => self::int()], ['order_id'], fn ($a, $api) => $api->post('/orders/'.(int) $a['order_id'].'/process'), write: true),
            self::tool('ship_order', 'Mark an order shipped (takes its stock out of the warehouse).', ['order_id' => self::int()], ['order_id'], fn ($a, $api) => $api->post('/orders/'.(int) $a['order_id'].'/ship'), write: true),
            self::tool('deliver_order', 'Mark a shipped order delivered.', ['order_id' => self::int()], ['order_id'], fn ($a, $api) => $api->post('/orders/'.(int) $a['order_id'].'/deliver'), write: true),
            self::tool('cancel_order', 'Cancel an order (releases reserved stock). Requires confirm=true.', ['order_id' => self::int()] + $confirm, ['order_id', 'confirm'], function ($a, ApiBridge $api) {
                self::requireConfirm($a);

                return $api->post('/orders/'.(int) $a['order_id'].'/cancel');
            }, write: true, destructive: true),
            self::tool('list_couriers', 'Delivery couriers, including whether each is connected to the Steadfast API.', [], [], fn ($a, $api) => $api->get('/couriers', $api->scoped(['per_page' => 100]))),
            self::tool('send_to_courier', 'Book a shipped order with an API-connected courier (Steadfast). Returns the shipment with its tracking code.', ['order_id' => self::int(), 'courier_id' => self::int(), 'note' => self::str()], ['order_id', 'courier_id'], fn ($a, $api) => $api->post('/orders/'.(int) $a['order_id'].'/send-to-courier', ['courier_id' => (int) $a['courier_id'], 'note' => $a['note'] ?? null]), write: true),
            self::tool('create_shipment', 'Record a shipment with a manual courier and tracking number for a shipped order.', ['order_id' => self::int(), 'courier_id' => self::int(), 'tracking_number' => self::str(), 'delivery_charge' => self::num(), 'notes' => self::str()], ['order_id', 'courier_id', 'tracking_number'], fn ($a, $api) => $api->post('/orders/'.(int) $a['order_id'].'/shipments', [
                'courier_id' => (int) $a['courier_id'],
                'tracking_number' => $a['tracking_number'],
                'delivery_charge' => isset($a['delivery_charge']) ? (string) $a['delivery_charge'] : null,
                'notes' => $a['notes'] ?? null,
            ]), write: true),
            self::tool('list_shipments', 'Shipments, optionally by status or courier.', ['status' => self::str(), 'courier_id' => self::int()] + $paging, [], fn ($a, $api) => $api->listing('/shipments', self::only($a, ['status', 'courier_id', 'page', 'per_page']))),
            self::tool('sync_courier_status', "Refresh a Steadfast shipment's delivery status from the courier.", ['shipment_id' => self::int()], ['shipment_id'], fn ($a, $api) => $api->post('/shipments/'.(int) $a['shipment_id'].'/sync-courier'), write: true),

            // ---- customers ------------------------------------------------
            self::tool('list_customers', 'Customers with lifetime spend, order count, last order and behavioural segment (vip, repeat, one_time, at_risk, inactive, new).', [
                'search' => self::str(),
                'segment' => self::enum(['vip', 'repeat', 'one_time', 'at_risk', 'inactive', 'new']),
                'sort' => self::enum(['spend', 'orders', 'recent', 'joined']),
                'direction' => self::enum(['asc', 'desc']),
            ] + $paging, [], fn ($a, $api) => $api->listing('/customers', self::only($a, ['search', 'segment', 'sort', 'direction', 'page', 'per_page']))),
            self::tool('customer_summary', 'Customer totals, growth, repeat rate, lifetime value, segment mix and top spenders.', [], [], fn ($a, $api) => $api->get('/customers/summary', $api->scoped())),
            self::tool('get_customer', 'One customer with addresses and store-credit balance.', ['customer_id' => self::int()], ['customer_id'], fn ($a, $api) => $api->get('/customers/'.(int) $a['customer_id'])),

            // ---- reports & analytics --------------------------------------
            self::tool('sales_report', 'Revenue, orders and average order value by day/week/month, with payment-method and courier breakdowns and the change vs the previous period.', $range + $granularity + ['warehouse_id' => self::int()], ['date_from', 'date_to'], fn ($a, $api) => $api->get('/reports/sales', $api->scoped(self::only($a, ['date_from', 'date_to', 'granularity', 'warehouse_id'])))),
            self::tool('sales_insights', 'Sales context: revenue by category, top customers, weekday pattern, order outcomes, discounts, shipping and new vs returning buyers.', $range + ['warehouse_id' => self::int()], ['date_from', 'date_to'], fn ($a, $api) => $api->get('/reports/sales/insights', $api->scoped(self::only($a, ['date_from', 'date_to', 'warehouse_id'])))),
            self::tool('product_performance', 'Units sold and revenue per product in a date range.', $range + $paging, ['date_from', 'date_to'], fn ($a, $api) => $api->listing('/reports/products-performance', self::only($a, ['date_from', 'date_to', 'page', 'per_page']))),
            self::tool('analytics_overview', 'Storefront traffic: page views, sessions, conversion, funnel counts and the trend, compared with the previous period.', $range + $granularity, ['date_from', 'date_to'], fn ($a, $api) => $api->get('/analytics/overview', $api->scoped(self::only($a, ['date_from', 'date_to', 'granularity'])))),
            self::tool('analytics_insights', 'Visitor behaviour: bounce rate, pages per session, returning visitors, cart/checkout abandonment, top pages, weekday and hour patterns.', $range, ['date_from', 'date_to'], fn ($a, $api) => $api->get('/analytics/overview/insights', $api->scoped(self::only($a, ['date_from', 'date_to'])))),
            self::tool('analytics_searches', 'What shoppers search for on the storefront, with result counts (spot demand you do not stock).', $range + $paging, ['date_from', 'date_to'], fn ($a, $api) => $api->listing('/analytics/searches', self::only($a, ['date_from', 'date_to', 'page', 'per_page']))),

            // ---- SEO & content --------------------------------------------
            self::tool('seo_audit', 'SEO health: scores per content type, the lowest-scoring items with edit links, and site-level checks.', [], [], fn ($a, $api) => $api->get('/seo/audit', $api->scoped())),
            self::tool('seo_settings', 'Site-level SEO configuration: homepage meta, robots, sitemap, schema, verification and analytics IDs.', [], [], fn ($a, $api) => $api->get('/seo/settings', $api->scoped())),
            self::tool('seo_generate', 'Generate missing SEO titles, descriptions and focus keywords for content types. By default only blank fields are filled.', [
                'entities' => ['type' => 'array', 'items' => self::enum(['products', 'pages', 'categories', 'brands', 'blog_posts', 'blog_categories', 'blog_tags'])],
                'overwrite' => ['type' => 'boolean', 'description' => 'Replace existing SEO text too (default false)'],
            ], ['entities'], fn ($a, $api) => $api->post('/seo/generate', ['store_id' => $api->storeId, 'entities' => $a['entities'], 'overwrite' => (bool) ($a['overwrite'] ?? false)]), write: true),
            self::tool('seo_rescore', 'Recalculate stored SEO scores after bulk edits.', [], [], fn ($a, $api) => $api->post('/seo/rescore', ['store_id' => $api->storeId]), write: true),
            self::tool('list_404s', 'Missing URLs visitors hit, most frequent first - candidates for redirects.', $paging, [], fn ($a, $api) => $api->listing('/seo/404', self::only($a, ['page', 'per_page']))),
            self::tool('list_redirects', 'Configured URL redirects.', [], [], fn ($a, $api) => $api->get('/redirects', $api->scoped())),
            self::tool('create_redirect', 'Redirect an old storefront path to a new one (301 by default).', ['from_path' => self::str('e.g. /products/old-name'), 'to_path' => self::str(), 'status_code' => ['type' => 'integer', 'enum' => [301, 302]]], ['from_path', 'to_path'], fn ($a, $api) => $api->post('/redirects', [
                'store_id' => $api->storeId,
                'from_path' => $a['from_path'],
                'to_path' => $a['to_path'],
                'status_code' => $a['status_code'] ?? 301,
            ]), write: true),
            self::tool('list_pages', 'Content pages (About, FAQ, policies...).', [], [], fn ($a, $api) => $api->get('/pages', $api->scoped())),
            self::tool('list_blog_posts', 'Blog posts.', ['search' => self::str(), 'status' => self::str()] + $paging, [], fn ($a, $api) => $api->listing('/blog-posts', self::only($a, ['search', 'status', 'page', 'per_page']))),
            self::tool('notification_log', 'Recent SMS and email notifications with delivery status and errors.', ['channel' => self::enum(['sms', 'email']), 'status' => self::enum(['sent', 'failed'])] + $paging, [], fn ($a, $api) => $api->listing('/notification-logs', self::only($a, ['channel', 'status', 'page', 'per_page']))),
        ];
    }

    // ---- helpers ------------------------------------------------------------

    /**
     * @param  array<string, array<string, mixed>>  $properties
     * @param  array<int, string>  $required
     */
    private static function tool(string $name, string $description, array $properties, array $required, callable $handler, bool $write = false, bool $destructive = false): array
    {
        $schema = ['type' => 'object', 'properties' => (object) $properties];

        if ($required) {
            $schema['required'] = $required;
        }

        return compact('name', 'description', 'write', 'destructive', 'handler') + ['inputSchema' => $schema];
    }

    private static function int(string $d = ''): array
    {
        return ['type' => 'integer'] + ($d !== '' ? ['description' => $d] : []);
    }

    private static function num(string $d = ''): array
    {
        return ['type' => 'number'] + ($d !== '' ? ['description' => $d] : []);
    }

    private static function str(string $d = ''): array
    {
        return ['type' => 'string'] + ($d !== '' ? ['description' => $d] : []);
    }

    /** @param array<int, string> $values */
    private static function enum(array $values): array
    {
        return ['type' => 'string', 'enum' => $values];
    }

    /**
     * @param  array<string, mixed>  $args
     * @param  array<int, string>  $keys
     * @return array<string, mixed>
     */
    private static function only(array $args, array $keys): array
    {
        return array_intersect_key($args, array_flip($keys));
    }

    /** @param array<string, mixed> $args */
    private static function requireConfirm(array $args): void
    {
        if (($args['confirm'] ?? false) !== true) {
            throw new McpToolException('This action is irreversible. Ask the user to confirm, then call again with confirm=true.', 422);
        }
    }

    /**
     * Merge-style product payload: what the admin API's PUT needs, built from
     * the current product plus only the fields the assistant supplied.
     *
     * @param  array<string, mixed>  $input
     * @param  array<string, mixed>  $existing
     * @return array<string, mixed>
     */
    private static function productPayload(array $input, array $existing, ApiBridge $api): array
    {
        $money = fn ($v) => $v === null ? null : (string) $v;

        $payload = [
            'store_id' => $api->storeId,
            'category_id' => $existing['category_id'] ?? null,
            'brand_id' => $existing['brand_id'] ?? null,
            'type' => $existing['type'] ?? 'simple',
            'name' => $existing['name'] ?? null,
            'slug' => $existing['slug'] ?? null,
            'sku' => $existing['sku'] ?? null,
            'barcode' => $existing['barcode'] ?? null,
            'description' => $existing['description'] ?? null,
            'short_description' => $existing['short_description'] ?? null,
            'price' => isset($existing['price']) ? (string) $existing['price'] : null,
            'sale_price' => $money($existing['sale_price'] ?? null),
            'cost_price' => $money($existing['cost_price'] ?? null),
            'compare_at_price' => $money($existing['compare_at_price'] ?? null),
            'weight' => $existing['weight'] ?? null,
            'weight_unit' => $existing['weight_unit'] ?? null,
            'track_stock' => $existing['track_stock'] ?? true,
            'low_stock_threshold' => $existing['low_stock_threshold'] ?? null,
            'status' => $existing['status'] ?? 'draft',
            'featured' => $existing['featured'] ?? false,
        ];

        $seoOverrides = [];

        foreach ($input as $key => $value) {
            if (in_array($key, ['seo_title', 'seo_description', 'focus_keyword'], true)) {
                $seoOverrides[match ($key) {
                    'seo_title' => 'title',
                    'seo_description' => 'description',
                    default => 'focus_keyword',
                }] = $value;

                continue;
            }

            $payload[$key] = in_array($key, ['price', 'sale_price', 'cost_price', 'compare_at_price'], true) ? $money($value) : $value;
        }

        if ($seoOverrides || ! empty($existing['seo'])) {
            $current = (array) ($existing['seo'] ?? []);
            $seo = [];
            foreach (self::SEO_KEYS as $key) {
                $seo[$key] = $current[$key] ?? null;
            }
            $payload['seo'] = array_merge($seo, $seoOverrides);
        }

        return $payload;
    }
}
