<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'store_id', 'code', 'description', 'discount_type', 'percentage_value', 'fixed_discount_amount',
    'currency_code', 'minimum_order_amount', 'usage_limit', 'used_count', 'per_customer_limit',
    'starts_at', 'expires_at', 'status',
])]
class Coupon extends Model
{
    use BelongsToStore;
    use HasFactory;

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function usages(): HasMany
    {
        return $this->hasMany(CouponUsage::class);
    }
}
