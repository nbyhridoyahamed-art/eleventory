<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['return_id', 'order_item_id', 'quantity', 'restock', 'exchange_product_id', 'exchange_product_variant_id'])]
class ReturnItem extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['restock' => 'boolean'];
    }

    public function orderReturn(): BelongsTo
    {
        return $this->belongsTo(OrderReturn::class, 'return_id');
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function exchangeProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'exchange_product_id')->withTrashed();
    }

    public function exchangeProductVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'exchange_product_variant_id');
    }
}
