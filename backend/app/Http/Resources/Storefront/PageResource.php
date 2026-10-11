<?php

namespace App\Http\Resources\Storefront;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'title' => $this->title,
            'slug' => $this->slug,
            'content' => $this->content,
            'seo' => $this->whenLoaded('seoMetadata', fn () => \App\Support\SeoTemplateResolver::payload($this->resource)),
        ];
    }
}
