<?php

namespace App\Http\Resources\Storefront;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Support\MediaLibrary;

/**
 * The product-card shape for listing/search/category/brand pages.
 * `in_stock` is computed in bulk by the controller and set onto each
 * model instance before this resource runs (see ProductController::
 * withInStock()) — never per-row here, to avoid an N+1 query per card.
 */
class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // The controller always eager-loads images for this resource.
        $images = $this->images ?? collect();
        $primaryImage = $images->firstWhere('is_primary', true) ?? $images->first();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'type' => $this->type,
            'currency_code' => $this->currency_code,
            'price' => (new Money($this->price_amount, $this->currency_code))->toDecimal(),
            'sale_price' => $this->sale_price_amount !== null ? (new Money($this->sale_price_amount, $this->currency_code))->toDecimal() : null,
            'compare_at_price' => $this->compare_at_price_amount !== null ? (new Money($this->compare_at_price_amount, $this->currency_code))->toDecimal() : null,
            'primary_image_url' => $primaryImage ? MediaLibrary::url($primaryImage->path) : null,
            'featured' => $this->featured,
            'in_stock' => (bool) $this->in_stock,
            'reviews_count' => (int) $this->reviews_count,
            'average_rating' => $this->average_rating !== null ? round((float) $this->average_rating, 1) : null,
        ];
    }
}
