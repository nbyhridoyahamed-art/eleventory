<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Str;

#[Fillable(['store_id', 'warehouse_id', 'reference', 'note', 'created_by'])]
class StockAdjustmentSession extends Model
{
    use BelongsToStore;
    use HasFactory;

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (StockAdjustmentSession $session) {
            $session->uuid ??= (string) Str::uuid();
        });
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function movements(): MorphMany
    {
        return $this->morphMany(StockMovement::class, 'reference')->orderBy('created_at');
    }
}
