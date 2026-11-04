<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable(['store_id', 'title', 'slug', 'excerpt', 'body', 'featured_image_url', 'blog_category_id', 'created_by', 'status', 'published_at'])]
class BlogPost extends Model
{
    use BelongsToStore;
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (BlogPost $post) {
            $post->uuid ??= (string) Str::uuid();
        });
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(BlogCategory::class, 'blog_category_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(BlogTag::class, 'blog_post_tag');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(BlogPostVersion::class)->latest();
    }

    public function seoMetadata(): MorphOne
    {
        return $this->morphOne(SeoMetadata::class, 'entity');
    }

    /**
     * Real scheduled publishing without extra cron infrastructure: a future
     * published_at on an already-published post is invisible until due, and
     * this single condition is shared by every storefront read path (index,
     * detail's related posts, category/tag archives) and the homepage
     * builder's Blog Posts block, so they can never drift out of sync.
     */
    public function scopePublished(Builder $query): void
    {
        $query->where('status', 'published')
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    /** Not stored — kept fresh automatically whenever body changes. */
    public function readingTimeMinutes(): int
    {
        return max(1, (int) ceil(str_word_count(strip_tags((string) $this->body)) / 200));
    }

    /** Falls back to a truncated plain-text lead-in when no manual excerpt was set. */
    public function displayExcerpt(int $length = 200): ?string
    {
        if ($this->excerpt) {
            return $this->excerpt;
        }

        return $this->body ? Str::limit(strip_tags($this->body), $length) : null;
    }
}
