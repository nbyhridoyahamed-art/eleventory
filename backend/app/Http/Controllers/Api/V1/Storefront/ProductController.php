<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Resources\ReviewResource;
use App\Http\Resources\Storefront\ProductDetailResource;
use App\Http\Resources\Storefront\ProductResource;
use App\Models\Product;
use App\Models\Review;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends StorefrontController
{
    public function index(Request $request): JsonResponse
    {
        $store = $this->currentStore();
        $perPage = min((int) $request->integer('per_page', 20), 60);

        $products = Product::query()
            ->where('store_id', $store->id)
            ->where('status', 'active')
            ->with('images')
            ->withCount('approvedReviews as reviews_count')
            ->withAvg('approvedReviews as average_rating', 'rating')
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(function ($q) use ($term) {
                    $q->where('name', 'like', $term)->orWhere('sku', 'like', $term);
                });
            })
            // A parent category also matches products filed under its children,
            // so picking "Mobile Accessories" lists its sub-categories' products too.
            ->when($request->filled('category'), fn ($query) => $query->whereHas(
                'category',
                fn ($q) => $q->where('slug', $request->string('category'))
                    ->orWhereHas('parent', fn ($p) => $p->where('slug', $request->string('category'))),
            ))
            ->when($request->filled('brand'), fn ($query) => $query->whereHas(
                'brand',
                fn ($q) => $q->where('slug', $request->string('brand')),
            ))
            ->when($request->boolean('featured'), fn ($query) => $query->where('featured', true))
            // Only products with sellable stock on hand (see attachInStock() for the same rule per row).
            ->when($request->boolean('in_stock'), fn ($query) => $query->whereRaw(
                '(select coalesce(sum(quantity - quantity_reserved), 0) from stock_levels where stock_levels.product_id = products.id) > 0',
            ))
            ->when($request->boolean('on_sale'), fn ($query) => $query
                ->whereNotNull('sale_price_amount')
                ->whereColumn('sale_price_amount', '<', 'price_amount'))
            // min_price / max_price are in major units (e.g. taka); amounts are stored in minor units.
            ->when($request->filled('min_price'), fn ($query) => $query->whereRaw(
                'COALESCE(sale_price_amount, price_amount) >= ?', [(int) round((float) $request->input('min_price') * 100)],
            ))
            ->when($request->filled('max_price'), fn ($query) => $query->whereRaw(
                'COALESCE(sale_price_amount, price_amount) <= ?', [(int) round((float) $request->input('max_price') * 100)],
            ))
            ->when($request->filled('sort'), function ($query) use ($request) {
                match ($request->string('sort')->toString()) {
                    'price_asc' => $query->orderBy('price_amount', 'asc'),
                    'price_desc' => $query->orderBy('price_amount', 'desc'),
                    'newest' => $query->latest(),
                    default => $query->orderBy('name'),
                };
            }, fn ($query) => $query->orderBy('name'))
            ->paginate($perPage);

        $this->attachInStock($products->getCollection());

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
     * Search-as-you-type suggestions for the header search box: keywords
     * (words in product names starting with what was typed, most common
     * first), matching categories and brands, and the best-matching
     * in-stock-first products. Deliberately small and cheap — it runs on
     * every pause in typing.
     */
    public function suggestions(Request $request): JsonResponse
    {
        $store = $this->currentStore();
        $term = trim((string) $request->query('q', ''));

        if (mb_strlen($term) < 2) {
            return ApiResponse::success(['keywords' => [], 'categories' => [], 'brands' => [], 'products' => []], 'Suggestions fetched successfully.');
        }

        // Escape LIKE wildcards so "50%" or "a_b" search literally.
        $like = '%'.addcslashes($term, '\\%_').'%';
        $prefix = addcslashes($term, '\\%_').'%';

        $stock = '(select coalesce(sum(quantity - quantity_reserved), 0) from stock_levels where stock_levels.product_id = products.id)';

        $base = fn () => Product::query()->where('store_id', $store->id)->where('status', 'active');

        $products = $base()
            ->where(fn ($q) => $q->where('name', 'like', $like)->orWhere('sku', 'like', $like))
            ->with('images')
            ->orderByRaw("({$stock} > 0) desc")
            ->orderByRaw('(name like ?) desc', [$prefix])
            ->orderBy('name')
            ->limit(6)
            ->get();

        // Keywords: pull the words that start with the typed text out of a wider
        // sample of matching names, then rank by how often they occur.
        $keywords = $base()
            ->where('name', 'like', $like)
            ->limit(120)
            ->pluck('name')
            ->flatMap(fn (string $name) => preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($name), -1, PREG_SPLIT_NO_EMPTY))
            ->filter(fn (string $word) => str_starts_with($word, mb_strtolower($term)) && mb_strlen($word) >= 3)
            ->countBy()
            ->sortDesc()
            ->keys()
            ->take(6)
            ->values();

        $categories = \App\Models\Category::query()
            ->where('store_id', $store->id)->where('status', 'active')->where('name', 'like', $like)
            ->orderBy('name')->limit(4)->get(['name', 'slug']);

        $brands = \App\Models\Brand::query()
            ->where('store_id', $store->id)->where('status', 'active')->where('name', 'like', $like)
            ->orderBy('name')->limit(4)->get(['name', 'slug']);

        return ApiResponse::success([
            'keywords' => $keywords,
            'categories' => $categories,
            'brands' => $brands,
            'products' => $products->map(fn (Product $product) => [
                'name' => $product->name,
                'slug' => $product->slug,
                'price' => (new \App\Support\Money($product->price_amount, $product->currency_code))->toDecimal(),
                'sale_price' => $product->sale_price_amount !== null
                    ? (new \App\Support\Money($product->sale_price_amount, $product->currency_code))->toDecimal()
                    : null,
                'currency_code' => $product->currency_code,
                'image_url' => ($path = $product->images->firstWhere('is_primary', true)?->path ?? $product->images->first()?->path)
                    ? \Illuminate\Support\Facades\Storage::disk('public')->url($path)
                    : null,
            ]),
        ], 'Suggestions fetched successfully.');
    }

    /**
     * Counts for the shop page's filter sidebar: active products per category
     * (a parent includes its children) and per brand. Keyed by slug.
     */
    public function facets(): JsonResponse
    {
        $store = $this->currentStore();

        $base = fn () => Product::query()->where('store_id', $store->id)->where('status', 'active');

        $byCategoryId = $base()->whereNotNull('category_id')
            ->selectRaw('category_id, COUNT(*) as total')->groupBy('category_id')->pluck('total', 'category_id');

        $categories = \App\Models\Category::query()->where('store_id', $store->id)->get(['id', 'slug', 'parent_id']);
        $categoryCounts = [];
        foreach ($categories as $category) {
            $own = (int) ($byCategoryId[$category->id] ?? 0);
            $categoryCounts[$category->slug] = ($categoryCounts[$category->slug] ?? 0) + $own;
            if ($category->parent_id) {
                $parentSlug = $categories->firstWhere('id', $category->parent_id)?->slug;
                if ($parentSlug) {
                    $categoryCounts[$parentSlug] = ($categoryCounts[$parentSlug] ?? 0) + $own;
                }
            }
        }

        $byBrandId = $base()->whereNotNull('brand_id')
            ->selectRaw('brand_id, COUNT(*) as total')->groupBy('brand_id')->pluck('total', 'brand_id');

        $brandCounts = \App\Models\Brand::query()->where('store_id', $store->id)->whereIn('id', $byBrandId->keys())
            ->pluck('slug', 'id')->mapWithKeys(fn ($slug, $id) => [$slug => (int) $byBrandId[$id]]);

        $range = $base()->selectRaw('MIN(COALESCE(sale_price_amount, price_amount)) as min_price, MAX(COALESCE(sale_price_amount, price_amount)) as max_price')->first();

        return ApiResponse::success([
            'categories' => $categoryCounts,
            'brands' => $brandCounts,
            'price_range' => [
                'min' => (int) floor(((int) $range->min_price) / 100),
                'max' => (int) ceil(((int) $range->max_price) / 100),
            ],
        ], 'Facets fetched successfully.');
    }

    public function show(string $slug): JsonResponse
    {
        $store = $this->currentStore();

        $product = Product::query()
            ->where('store_id', $store->id)
            ->where('status', 'active')
            ->where('slug', $slug)
            ->with([
                'category', 'brand', 'images', 'seoMetadata',
                'variants.attributeValues.attribute', 'variants.stockLevels',
                'bundleItems.componentProduct',
            ])
            ->withCount('approvedReviews as reviews_count')
            ->withAvg('approvedReviews as average_rating', 'rating')
            ->firstOrFail();

        $this->attachInStock(collect([$product]));

        foreach ($product->variants as $variant) {
            $variant->in_stock = $variant->stockLevels->sum(fn ($level) => $level->quantity - $level->quantity_reserved) > 0;
        }

        return ApiResponse::success(new ProductDetailResource($product), 'Product fetched successfully.');
    }

    public function reviews(Request $request, string $slug): JsonResponse
    {
        $store = $this->currentStore();

        $product = Product::query()
            ->where('store_id', $store->id)
            ->where('status', 'active')
            ->where('slug', $slug)
            ->firstOrFail();

        $perPage = min((int) $request->integer('per_page', 10), 50);

        $reviews = Review::query()
            ->where('product_id', $product->id)
            ->where('status', 'approved')
            ->with('customer')
            ->latest()
            ->paginate($perPage);

        return ApiResponse::success(
            ReviewResource::collection($reviews),
            'Reviews fetched successfully.',
            [
                'current_page' => $reviews->currentPage(),
                'per_page' => $reviews->perPage(),
                'total' => $reviews->total(),
                'last_page' => $reviews->lastPage(),
            ],
        );
    }
}
