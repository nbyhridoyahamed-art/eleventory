<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable([
    'store_id', 'type', 'settings', 'styles', 'responsive', 'visibility',
    'animation', 'sort_order', 'is_active', 'scheduled_at', 'created_by',
])]
class HomepageBlock extends Model
{
    use BelongsToStore;
    use HasFactory;

    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'styles' => 'array',
            'responsive' => 'array',
            'visibility' => 'array',
            'is_active' => 'boolean',
            'scheduled_at' => 'datetime',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (HomepageBlock $block) {
            $block->uuid ??= (string) Str::uuid();
        });
    }

    /** Cache key for the storefront's resolved homepage — shared with HomepageBlockController, which invalidates it. */
    public static function storefrontCacheKey(int $storeId): string
    {
        return "storefront:homepage:{$storeId}";
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(HomepageBlockRevision::class)->latest('id');
    }

    /**
     * A frozen copy of this block's own config columns, for
     * HomepageBlockRevision::snapshot / SavedSection creation.
     *
     * @return array<string, mixed>
     */
    public function toSnapshot(): array
    {
        return [
            'type' => $this->type,
            'settings' => $this->settings,
            'styles' => $this->styles,
            'responsive' => $this->responsive,
            'visibility' => $this->visibility,
            'animation' => $this->animation,
            'is_active' => $this->is_active,
        ];
    }
}
