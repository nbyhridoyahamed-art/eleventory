<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'store_id' => $this->store_id,
            'parent_id' => $this->parent_id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'image_path' => $this->image_path,
            'image_url' => $this->image_path ? asset('storage/'.$this->image_path) : null,
            'sort_order' => $this->sort_order,
            'status' => $this->status,
            'products_count' => $this->whenCounted('products'),
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
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
