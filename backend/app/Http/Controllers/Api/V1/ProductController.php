<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\SyncsSeoMetadata;
use App\Http\Controllers\Controller;
use App\Http\Requests\Product\ProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Support\ApiResponse;
use App\Support\HtmlSanitizer;
use App\Support\Money;
use App\Support\ProductCsv;
use App\Support\SkuGenerator;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductController extends Controller
{
    use SyncsSeoMetadata;

    private const RELATIONS = [
        'category', 'brand', 'images', 'seoMetadata', 'variants.attributeValues.attribute', 'variants.stockLevels.warehouse',
        'bundleItems.componentProduct', 'bundleItems.componentVariant',
    ];

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Product::class);

        $perPage = min((int) $request->integer('per_page', 20), 100);

        $products = $this->applyFilters(Product::query()->with(self::RELATIONS), $request)
            ->latest()
            ->paginate($perPage);

        return ApiResponse::success(
            ProductResource::collection($products),
            'Products fetched successfully.',
            [
                'current_page' => $products->currentPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
                'last_page' => $products->lastPage(),
            ],
        );
    }

    /**
     * Exports every product matching the same filters as index() — not just
     * the current page — as a CSV a store operator can edit and re-import
     * (see ProductImportController). Every type exports; the Type column is
     * informational only, since import never creates or edits variants or
     * bundle components (import stays scoped to simple products only).
     */
    public function export(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Product::class);

        $products = $this->applyFilters(Product::query()->with(['category', 'brand']), $request)
            ->orderBy('name')
            ->get();

        return response()->streamDownload(function () use ($products) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, array_keys(ProductCsv::HEADERS));

            foreach ($products as $product) {
                fputcsv($handle, [
                    $product->type,
                    $product->sku,
                    $product->name,
                    $product->slug,
                    $product->category?->name,
                    $product->brand?->name,
                    $product->status,
                    $product->featured ? '1' : '0',
                    (new Money($product->price_amount, $product->currency_code))->toDecimal(),
                    $product->sale_price_amount !== null ? (new Money($product->sale_price_amount, $product->currency_code))->toDecimal() : null,
                    $product->cost_price_amount !== null ? (new Money($product->cost_price_amount, $product->currency_code))->toDecimal() : null,
                    $product->compare_at_price_amount !== null ? (new Money($product->compare_at_price_amount, $product->currency_code))->toDecimal() : null,
                    $product->description,
                    $product->short_description,
                    $product->barcode,
                    $product->weight,
                    $product->weight_unit,
                    $product->track_stock ? '1' : '0',
                    $product->low_stock_threshold,
                ]);
            }

            fclose($handle);
        }, 'products-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    private function applyFilters(Builder $query, Request $request): Builder
    {
        return $query
            ->when($request->filled('store_id'), fn ($q) => $q->where('store_id', $request->integer('store_id')))
            ->when($request->filled('search'), fn ($q) => $q->where(function ($q2) use ($request) {
                $term = '%'.$request->string('search').'%';
                $q2->where('name', 'like', $term)->orWhere('sku', 'like', $term);
            }))
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->integer('category_id')))
            ->when($request->filled('brand_id'), fn ($q) => $q->where('brand_id', $request->integer('brand_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')));
    }

    public function store(ProductRequest $request): JsonResponse
    {
        $this->authorize('create', Product::class);

        $data = $this->preparePayload($request);
        // Set explicitly rather than leaning on the migration's column
        // defaults: Product::create() returns the in-memory model built
        // from $data, not a fresh SELECT, so any field left for the DB
        // default to fill in would come back null in this response.
        $data['type'] ??= 'simple';
        $data['status'] ??= 'draft';
        $data['track_stock'] ??= true;
        $data['featured'] ??= false;
        $data['created_by'] = $request->user()->id;
        $data['updated_by'] = $request->user()->id;
        $data['sku'] ??= SkuGenerator::generate(
            (int) $data['store_id'],
            isset($data['brand_id']) ? Brand::query()->whereKey($data['brand_id'])->value('name') : null,
            isset($data['category_id']) ? Category::query()->whereKey($data['category_id'])->value('name') : null,
        );
        if ($data['status'] === 'active') {
            $data['published_at'] = now();
        }
        if ($data['type'] === 'bundle') {
            $this->clearOwnStockFields($data);
        }

        $product = Product::create($data);
        $this->syncSeoMetadata($product, $request);

        return ApiResponse::success(new ProductResource($product->load(self::RELATIONS)), 'Product created successfully.', status: 201);
    }

    /** The SKU a new product would receive, so the form can show it before saving. */
    public function nextSku(Request $request): JsonResponse
    {
        $this->authorize('create', Product::class);

        $storeId = $request->integer('store_id');

        return ApiResponse::success([
            'sku' => SkuGenerator::generate(
                $storeId,
                $request->filled('brand_id') ? Brand::query()->where('store_id', $storeId)->whereKey($request->integer('brand_id'))->value('name') : null,
                $request->filled('category_id') ? Category::query()->where('store_id', $storeId)->whereKey($request->integer('category_id'))->value('name') : null,
            ),
        ], 'Next SKU generated successfully.');
    }

    public function show(Product $product): JsonResponse
    {
        $this->authorize('view', $product);

        return ApiResponse::success(new ProductResource($product->load(self::RELATIONS)), 'Product fetched successfully.');
    }

    public function update(ProductRequest $request, Product $product): JsonResponse
    {
        $this->authorize('update', $product);

        $data = $this->preparePayload($request);
        $data['updated_by'] = $request->user()->id;
        if (($data['status'] ?? null) === 'active' && $product->published_at === null) {
            $data['published_at'] = now();
        }
        if (($data['type'] ?? $product->type) === 'bundle') {
            $this->clearOwnStockFields($data);
        }

        $product->update($data);
        $this->syncSeoMetadata($product, $request);

        return ApiResponse::success(new ProductResource($product->load(self::RELATIONS)), 'Product updated successfully.');
    }

    public function destroy(Product $product): JsonResponse
    {
        $this->authorize('delete', $product);

        $product->delete();

        return ApiResponse::success(message: 'Product deleted successfully.');
    }

    /**
     * Converts the request's decimal money fields to the minor-unit columns
     * the model actually stores, and drops the decimal-named keys so they
     * never reach a mass-assignment call.
     */
    private function preparePayload(ProductRequest $request): array
    {
        $data = $request->validated();
        $currency = $data['currency_code'] ?? 'BDT';

        $data['currency_code'] = $currency;
        $data['price_amount'] = Money::fromDecimal($data['price'], $currency)->amountMinor;
        $data['sale_price_amount'] = Money::fromDecimal($data['sale_price'] ?? null, $currency)?->amountMinor;
        $data['cost_price_amount'] = Money::fromDecimal($data['cost_price'] ?? null, $currency)?->amountMinor;
        $data['compare_at_price_amount'] = Money::fromDecimal($data['compare_at_price'] ?? null, $currency)?->amountMinor;

        unset($data['price'], $data['sale_price'], $data['cost_price'], $data['compare_at_price'], $data['seo']);

        // The editor sends HTML; keep only formatting, never scripts or event handlers.
        $data['description'] = HtmlSanitizer::clean($data['description'] ?? null);

        if (blank($data['sku'] ?? null)) {
            unset($data['sku']);
        }

        return $data;
    }

    /**
     * A bundle never holds real stock of its own — its "available to sell"
     * quantity is derived from its components (see BundleExpander), not a
     * stock_levels row it owns. Forcing track_stock off (and clearing any
     * threshold) here, rather than only hiding the fields client-side, keeps
     * a bundle out of the low-stock report regardless of what a raw API
     * request submits — otherwise a bundle with track_stock left true and a
     * threshold set would show 0 on hand against a positive threshold and
     * incorrectly appear "low stock" on every single request.
     */
    private function clearOwnStockFields(array &$data): void
    {
        $data['track_stock'] = false;
        $data['low_stock_threshold'] = null;
    }
}
