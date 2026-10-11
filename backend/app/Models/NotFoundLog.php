<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One row per missing storefront path, with a hit counter (the SEO 404 monitor). */
#[Fillable(['store_id', 'path', 'path_hash', 'hits', 'last_referrer', 'last_user_agent', 'first_seen_at', 'last_seen_at'])]
class NotFoundLog extends Model
{
    protected function casts(): array
    {
        return [
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }
}
