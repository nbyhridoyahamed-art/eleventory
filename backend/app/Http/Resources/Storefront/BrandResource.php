<?php

namespace App\Http\Resources\Storefront;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Support\MediaLibrary;

class BrandResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'logo_url' => $this->logo_path ? MediaLibrary::url($this->logo_path) : null,
            'seo' => $this->whenLoaded('seoMetadata', fn () => \App\Support\SeoTemplateResolver::payload($this->resource)),
        ];
    }
}
