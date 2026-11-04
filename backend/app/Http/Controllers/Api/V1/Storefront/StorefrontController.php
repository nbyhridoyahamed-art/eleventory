<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Controllers\Controller;
use App\Models\StockLevel;
use App\Models\Store;
use App\Support\BundleExpander;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Collection;

/**
 * Base for every public, unauthenticated storefront endpoint. The schema
 * already supports multiple stores per org, but nothing yet resolves
 * "which store" a storefront request is for (a real deployment would do
 * this from the request's domain — `stores.domain` already exists for
 * that) — Wave 1 deliberately keeps this simple and serves whichever
 * store is active, since every environment so far only seeds one. Real
 * domain-based resolution is a documented Wave 2 concern, not invented
 * ahead of a second store to test it against.
 */
abstract class StorefrontController extends Controller
{
    protected function currentStore(): Store
    {
        $store = Store::where('status', 'active')->firstOrFail();

        app(TenantContext::class)->set($store->id);

        return $store;
    }

    /**
     * Sets a computed `in_stock` attribute on each product — a single
     * grouped query covers every non-bundle product in the collection; a
     * bundle (which has no stock_levels row of its own) falls back to
     * BundleExpander::availability(), typically for a small minority of a
     * page's rows rather than every one of them. Shared by every storefront
     * controller that lists products (catalog, category, brand pages).
     */
    protected function attachInStock(Collection $products): void
    {
        $nonBundleIds = $products->where('type', '!=', 'bundle')->pluck('id');

        $availableByProduct = StockLevel::query()
            ->whereIn('product_id', $nonBundleIds)
            ->selectRaw('product_id, SUM(quantity - quantity_reserved) as available')
            ->groupBy('product_id')
            ->pluck('available', 'product_id');

        foreach ($products as $product) {
            $product->in_stock = $product->type === 'bundle'
                ? BundleExpander::availability($product->id)['total_available'] > 0
                : ($availableByProduct[$product->id] ?? 0) > 0;
        }
    }
}
