<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BlogPostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'store_id' => $this->store_id,
            'title' => $this->title,
            'slug' => $this->slug,
            'excerpt' => $this->excerpt,
            'body' => $this->body,
            'featured_image_url' => $this->featured_image_url,
            'blog_category_id' => $this->blog_category_id,
            'category' => new BlogCategoryResource($this->whenLoaded('category')),
            'tags' => BlogTagResource::collection($this->whenLoaded('tags')),
            'status' => $this->status,
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
            'published_at' => $this->published_at,
            'author' => $this->whenLoaded('author', fn () => $this->author?->name),
            'reading_time_minutes' => $this->readingTimeMinutes(),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
