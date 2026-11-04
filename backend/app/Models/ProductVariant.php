<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable(['store_id', 'product_id', 'sku', 'barcode', 'price_amount', 'sale_price_amount', 'cost_price_amount', 'status'])]
class ProductVariant extends Model
{
    use BelongsToStore;
    use HasFactory;

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (ProductVariant $variant) {
            $variant->uuid ??= (string) Str::uuid();
        });
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function attributeValues(): BelongsToMany
    {
        return $this->belongsToMany(
            ProductAttributeValue::class,
            'product_variant_attribute_values',
        )->withTimestamps();
    }

    public function stockLevels(): HasMany
    {
        return $this->hasMany(StockLevel::class);
    }
}
