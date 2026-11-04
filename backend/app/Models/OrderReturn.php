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
    'store_id', 'order_id', 'return_number', 'status', 'reason', 'refund_amount', 'refund_method',
    'refunded_at', 'note', 'replacement_order_id', 'created_by',
])]
class OrderReturn extends Model
{
    use BelongsToStore;
    use HasFactory;

    // "Return" is a reserved word in PHP and can't be a class name — the
    // model is named OrderReturn, but the table (matching the rest of the
    // schema/API/frontend, which all just say "returns") stays `returns`.
    protected $table = 'returns';

    protected function casts(): array
    {
        return ['refunded_at' => 'datetime'];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (OrderReturn $return) {
            $return->uuid ??= (string) Str::uuid();
        });
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ReturnItem::class, 'return_id');
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(ReturnStatusHistory::class, 'return_id')->orderBy('created_at');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** The zero-value Order receive() created to ship this return's exchange item(s), if any. */
    public function replacementOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'replacement_order_id');
    }
}
