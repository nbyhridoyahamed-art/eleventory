<?php

namespace App\Http\Resources\Storefront;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class BrandResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'logo_url' => $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null,
            'seo' => $this->whenLoaded('seoMetadata', fn () => \App\Support\SeoTemplateResolver::payload($this->resource)),
        ];
    }
}
