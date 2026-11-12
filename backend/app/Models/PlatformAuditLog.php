<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformAuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['actor_id', 'store_id', 'action', 'meta', 'ip'];

    protected function casts(): array
    {
        return ['meta' => 'array', 'created_at' => 'datetime'];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /** Append an entry. Never throws: an audit hiccup must not block the action, but it is logged. */
    public static function record(?User $actor, string $action, ?int $storeId = null, array $meta = []): void
    {
        try {
            static::create([
                'actor_id' => $actor?->id,
                'store_id' => $storeId,
                'action' => $action,
                'meta' => $meta ?: null,
                'ip' => request()?->ip(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
