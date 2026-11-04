<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

#[Fillable([
    'store_id', 'order_number', 'customer_id', 'warehouse_id', 'status',
    'payment_method', 'payment_status', 'source', 'currency_code', 'shipping_amount', 'discount_amount',
    'store_credit_amount', 'customer_address_id', 'shipping_recipient_name', 'shipping_phone', 'shipping_address_line',
    'shipping_bd_division_id', 'shipping_bd_district_id', 'shipping_bd_upazila_id',
    'notes', 'created_by',
])]
class Order extends Model
{
    use BelongsToStore;
    use HasFactory;

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Order $order) {
            $order->uuid ??= (string) Str::uuid();
        });
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function customerAddress(): BelongsTo
    {
        return $this->belongsTo(CustomerAddress::class);
    }

    public function shippingDivision(): BelongsTo
    {
        return $this->belongsTo(BdDivision::class, 'shipping_bd_division_id');
    }

    public function shippingDistrict(): BelongsTo
    {
        return $this->belongsTo(BdDistrict::class, 'shipping_bd_district_id');
    }

    public function shippingUpazila(): BelongsTo
    {
        return $this->belongsTo(BdUpazila::class, 'shipping_bd_upazila_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class)->orderBy('created_at');
    }

    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class)->orderBy('id');
    }

    /** The current/most recent shipment — the one a courier-assignment or delivery action acts on. */
    public function latestShipment(): HasOne
    {
        return $this->hasOne(Shipment::class)->latestOfMany();
    }

    public function returns(): HasMany
    {
        return $this->hasMany(OrderReturn::class);
    }

    /** The return whose exchange item(s) this order exists to ship, if this order was created that way. */
    public function sourceReturn(): HasOne
    {
        return $this->hasOne(OrderReturn::class, 'replacement_order_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->orderBy('created_at');
    }

    public function couponUsage(): HasOne
    {
        return $this->hasOne(CouponUsage::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Sum of every line item's quantity × unit price. Loads items if not already loaded. */
    public function subtotalAmount(): int
    {
        return $this->items->sum(fn (OrderItem $item) => $item->quantity * $item->unit_price_amount);
    }

    /** Subtotal plus shipping minus discount minus redeemed store credit — never stored, always derived, same rule as purchase_orders.total_amount. */
    public function totalAmount(): int
    {
        return $this->subtotalAmount() + $this->shipping_amount - $this->discount_amount - $this->store_credit_amount;
    }
}
