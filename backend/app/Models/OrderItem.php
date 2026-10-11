<?php

namespace App\Models;

use App\Support\BundleExpander;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

#[Fillable(['order_id', 'product_id', 'product_variant_id', 'quantity', 'unit_price_amount'])]
class OrderItem extends Model
{
    use HasFactory;

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
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

    /** What actually gets reserved/decremented/restocked — see order_item_components migration. */
    public function components(): HasMany
    {
        return $this->hasMany(OrderItemComponent::class);
    }

    /**
     * The component rows to use for a stock operation on this item: the
     * snapshot taken at order-creation time (`components`, preferred — see
     * order_item_components migration), or a live BundleExpander::expand()
     * for an item that was never snapshotted, e.g. built directly rather
     * than through OrderController::syncItems() (some test fixtures do
     * this). That fallback can't reintroduce the race condition the
     * snapshot exists to avoid — an item with no snapshot never went
     * through the real order-creation flow that race depends on.
     */
    public function resolvedComponents(): Collection
    {
        $components = $this->components;

        return $components->isNotEmpty() ? $components : BundleExpander::expand($this->product_id, $this->product_variant_id, $this->quantity);
    }
}
