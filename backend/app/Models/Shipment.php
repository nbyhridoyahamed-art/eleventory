<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable([
    'store_id', 'order_id', 'courier_id', 'tracking_number', 'status',
    'delivery_charge_amount', 'cod_amount_collected', 'cod_settled',
    'delivered_at', 'notes', 'created_by', 'external_id', 'courier_status',
])]
class Shipment extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'cod_settled' => 'boolean',
            'delivered_at' => 'datetime',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Shipment $shipment) {
            $shipment->uuid ??= (string) Str::uuid();
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

    public function courier(): BelongsTo
    {
        return $this->belongsTo(Courier::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(ShipmentStatusHistory::class)->orderBy('created_at');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function codSettlements(): BelongsToMany
    {
        return $this->belongsToMany(CodSettlement::class, 'cod_settlement_shipments');
    }
}
