<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable(['store_id', 'purchase_order_id', 'return_number', 'status', 'reason', 'credit_amount', 'credited_at', 'note', 'created_by'])]
class PurchaseReturn extends Model
{
    use BelongsToStore;
    use HasFactory;

    protected function casts(): array
    {
        return ['credited_at' => 'datetime'];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (PurchaseReturn $return) {
            $return->uuid ??= (string) Str::uuid();
        });
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseReturnItem::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(PurchaseReturnStatusHistory::class)->orderBy('created_at');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
