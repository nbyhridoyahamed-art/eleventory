<?php

namespace App\Http\Resources\Storefront;

use App\Http\Resources\ProductImageResource;
use App\Support\BundleExpander;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'type' => $this->type,
            'description' => $this->description,
            'short_description' => $this->short_description,
            'currency_code' => $this->currency_code,
            'price' => (new Money($this->price_amount, $this->currency_code))->toDecimal(),
            'sale_price' => $this->sale_price_amount !== null ? (new Money($this->sale_price_amount, $this->currency_code))->toDecimal() : null,
            'compare_at_price' => $this->compare_at_price_amount !== null ? (new Money($this->compare_at_price_amount, $this->currency_code))->toDecimal() : null,
            'weight' => $this->weight,
            'weight_unit' => $this->weight_unit,
            'category' => $this->whenLoaded('category', fn () => $this->category ? [
                'id' => $this->category->id, 'name' => $this->category->name, 'slug' => $this->category->slug,
            ] : null),
            'brand' => $this->whenLoaded('brand', fn () => $this->brand ? [
                'id' => $this->brand->id, 'name' => $this->brand->name, 'slug' => $this->brand->slug,
            ] : null),
            'images' => ProductImageResource::collection($this->whenLoaded('images')),
            'variants' => VariantResource::collection($this->whenLoaded('variants')),
            // Only what a customer needs to know what's inside — never the
            // component's own cost, which is purchasing-internal data.
            'components' => $this->whenLoaded('bundleItems', fn () => $this->bundleItems->map(fn ($item) => [
                'product_name' => $item->componentProduct->name,
                'product_slug' => $item->componentProduct->slug,
                'quantity' => $item->quantity,
            ])),
            'bundle_availability' => $this->when($this->type === 'bundle', fn () => [
                'total_available' => BundleExpander::availability($this->id)['total_available'],
            ]),
            'in_stock' => (bool) $this->in_stock,
            'reviews_count' => (int) $this->reviews_count,
            'average_rating' => $this->average_rating !== null ? round((float) $this->average_rating, 1) : null,
            'seo' => $this->whenLoaded('seoMetadata', fn () => \App\Support\SeoTemplateResolver::payload($this->resource)),
        ];
    }
}
