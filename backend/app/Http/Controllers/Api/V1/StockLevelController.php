<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\StockLevelResource;
use App\Models\Product;
use App\Models\StockLevel;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockLevelController extends Controller
{
    /**
     * Current on-hand quantity per product at one warehouse, summed across
     * every variant (a variable product's stock lives entirely in its
     * variants' own stock_levels rows — this list stays product-centric per
     * variant granularity is surfaced on the product's own Variants tab
     * instead, so a product with several variants still shows as one row
     * here). Products without any stock_levels row yet (nothing has moved
     * for them there) still show up with quantity 0 via the left join.
     * "Low stock" (and the low_stock filter) compares against *available*
     * stock (quantity - quantity_reserved), not raw on-hand quantity — once
     * Phase 8 orders reserve stock, on-hand alone overstates what's
     * actually sellable.
     */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->can('inventory.view')) {
            throw new AuthorizationException;
        }

        $request->validate([
            'store_id' => ['required', 'exists:stores,id'],
            'warehouse_id' => ['required', 'exists:warehouses,id'],
        ]);

        $storeId = $request->integer('store_id');
        $warehouseId = $request->integer('warehouse_id');
        $perPage = min((int) $request->integer('per_page', 20), 100);
        $lowStockOnly = $request->boolean('low_stock');

        // Per-product sums at this warehouse as correlated subqueries rather than
        // a left join + GROUP BY: `select products.*` with a bare GROUP BY
        // products.id is rejected by MySQL/MariaDB under ONLY_FULL_GROUP_BY
        // (every other products column "isn't in GROUP BY"), while SQLite — which
        // the test suite runs on — silently allows it.
        $quantitySql = '(select COALESCE(SUM(sl.quantity), 0) from stock_levels sl where sl.product_id = products.id and sl.warehouse_id = ?)';
        $reservedSql = '(select COALESCE(SUM(sl.quantity_reserved), 0) from stock_levels sl where sl.product_id = products.id and sl.warehouse_id = ?)';

        $products = Product::query()
            ->where('products.store_id', $storeId)
            // A bundle never has its own stock_levels row (see BundleExpander)
            // — it would otherwise show up here as a misleading "0 on hand"
            // rather than being left off a list about real per-warehouse
            // physical stock.
            ->where('products.type', '!=', 'bundle')
            ->select('products.*')
            ->selectRaw("{$quantitySql} as warehouse_quantity", [$warehouseId])
            ->selectRaw("{$reservedSql} as warehouse_reserved", [$warehouseId])
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(function ($q) use ($term) {
                    $q->where('products.name', 'like', $term)->orWhere('products.sku', 'like', $term);
                });
            })
            ->when($lowStockOnly, fn ($query) => $query
                ->where('products.track_stock', true)
                ->whereNotNull('products.low_stock_threshold')
                ->whereRaw("({$quantitySql} - {$reservedSql}) <= products.low_stock_threshold", [$warehouseId, $warehouseId]))
            ->orderBy('products.name')
            ->paginate($perPage);

        return ApiResponse::success(
            StockLevelResource::collection($products),
            'Stock levels fetched successfully.',
            [
                'current_page' => $products->currentPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
                'last_page' => $products->lastPage(),
            ],
        );
    }

    /**
     * Count of (product, warehouse) pairs currently at or below their
     * product's low_stock_threshold — comparing *available* stock
     * (quantity - quantity_reserved), across every warehouse in the
     * store — backs the dashboard's "Low stock alerts" KPI.
     */
    public function lowStockCount(Request $request): JsonResponse
    {
        if (! $request->user()->can('inventory.view')) {
            throw new AuthorizationException;
        }

        $request->validate(['store_id' => ['required', 'exists:stores,id']]);

        $count = StockLevel::query()
            ->join('products', 'products.id', '=', 'stock_levels.product_id')
            ->where('products.store_id', $request->integer('store_id'))
            ->where('products.track_stock', true)
            ->whereNotNull('products.low_stock_threshold')
            ->whereRaw('(stock_levels.quantity - stock_levels.quantity_reserved) <= products.low_stock_threshold')
            ->count();

        return ApiResponse::success(['count' => $count], 'Low stock count fetched successfully.');
    }
}
