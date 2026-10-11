<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['purchase_order_id', 'product_id', 'product_variant_id', 'quantity_ordered', 'quantity_received', 'unit_cost_amount'])]
class PurchaseOrderItem extends Model
{
    use HasFactory;

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function product(): BelongsTo
    {
        // Historical lines keep resolving a product that has since been (soft) deleted.
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function productVariant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function quantityRemaining(): int
    {
        return $this->quantity_ordered - $this->quantity_received;
    }
}
