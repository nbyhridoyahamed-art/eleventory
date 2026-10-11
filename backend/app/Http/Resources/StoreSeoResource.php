<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StoreSeoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'store_id' => $this->id,
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
        ];
    }
}
