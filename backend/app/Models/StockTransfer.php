<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Str;

#[Fillable(['store_id', 'transfer_number', 'from_warehouse_id', 'to_warehouse_id', 'status', 'note', 'created_by'])]
class StockTransfer extends Model
{
    use BelongsToStore;
    use HasFactory;

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (StockTransfer $transfer) {
            $transfer->uuid ??= (string) Str::uuid();
        });
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function fromWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'from_warehouse_id');
    }

    public function toWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'to_warehouse_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockTransferItem::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(StockTransferStatusHistory::class)->orderBy('created_at');
    }

    public function movements(): MorphMany
    {
        return $this->morphMany(StockMovement::class, 'reference')->orderBy('created_at');
    }
}
