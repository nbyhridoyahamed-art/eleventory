<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable([
    'store_id', 'entity_type', 'entity_id', 'title', 'description', 'focus_keyword',
    'og_title', 'og_description', 'og_image', 'twitter_title', 'twitter_description',
    'twitter_image', 'canonical_url', 'robots', 'schema_json',
])]
class SeoMetadata extends Model
{
    use BelongsToStore;
    use HasFactory;

    protected function casts(): array
    {
        return [
            'schema_json' => 'array',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function entity(): MorphTo
    {
        return $this->morphTo();
    }
}
