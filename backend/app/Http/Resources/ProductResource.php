<?php

namespace App\Http\Resources;

use App\Support\BundleExpander;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'store_id' => $this->store_id,
            'category' => $this->whenLoaded('category', fn () => $this->category ? [
                'id' => $this->category->id,
                'name' => $this->category->name,
            ] : null),
            'brand' => $this->whenLoaded('brand', fn () => $this->brand ? [
                'id' => $this->brand->id,
                'name' => $this->brand->name,
            ] : null),
            'category_id' => $this->category_id,
            'brand_id' => $this->brand_id,

            'name' => $this->name,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'barcode' => $this->barcode,
            'type' => $this->type,

            'description' => $this->description,
            'short_description' => $this->short_description,

            'currency_code' => $this->currency_code,
            'price' => (new Money($this->price_amount, $this->currency_code))->toDecimal(),
            'sale_price' => $this->sale_price_amount !== null
                ? (new Money($this->sale_price_amount, $this->currency_code))->toDecimal()
                : null,
            'cost_price' => $this->cost_price_amount !== null
                ? (new Money($this->cost_price_amount, $this->currency_code))->toDecimal()
                : null,
            'compare_at_price' => $this->compare_at_price_amount !== null
                ? (new Money($this->compare_at_price_amount, $this->currency_code))->toDecimal()
                : null,

            'weight' => $this->weight,
            'weight_unit' => $this->weight_unit,

            'track_stock' => $this->track_stock,
            'low_stock_threshold' => $this->low_stock_threshold,

            'status' => $this->status,
            'featured' => $this->featured,

            'seo' => $this->whenLoaded('seoMetadata', fn () => $this->seoMetadata ? [
                'title' => $this->seoMetadata->title,
                'description' => $this->seoMetadata->description,
                'focus_keyword' => $this->seoMetadata->focus_keyword,
                'og_title' => $this->seoMetadata->og_title,
                'og_description' => $this->seoMetadata->og_description,
                'og_image' => $this->seoMetadata->og_image,
                'twitter_title' => $this->seoMetadata->twitter_title,
                'twitter_description' => $this->seoMetadata->twitter_description,
                'twitter_image' => $this->seoMetadata->twitter_image,
                'canonical_url' => $this->seoMetadata->canonical_url,
                'robots' => $this->seoMetadata->robots,
                'score' => $this->seoMetadata->score,
                'schema_json' => $this->seoMetadata->schema_json,
            ] : null),

            'images' => ProductImageResource::collection($this->whenLoaded('images')),
            'variants' => ProductVariantResource::collection($this->whenLoaded('variants')),
            'components' => BundleItemResource::collection($this->whenLoaded('bundleItems')),
            // How many of this bundle can currently be sold — derived from
            // its components (BundleExpander), since a bundle never holds
            // real stock of its own.
            'bundle_availability' => $this->when($this->type === 'bundle', fn () => BundleExpander::availability($this->id)),

            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
