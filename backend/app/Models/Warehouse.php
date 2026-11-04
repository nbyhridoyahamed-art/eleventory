<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable([
    'store_id', 'name', 'code', 'type', 'manager_name', 'phone', 'address_line',
    'bd_division_id', 'bd_district_id', 'bd_upazila_id', 'status',
])]
class Warehouse extends Model
{
    use BelongsToStore;
    use HasFactory, SoftDeletes;

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Warehouse $warehouse) {
            $warehouse->uuid ??= (string) Str::uuid();
        });
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function division(): BelongsTo
    {
        return $this->belongsTo(BdDivision::class, 'bd_division_id');
    }

    public function district(): BelongsTo
    {
        return $this->belongsTo(BdDistrict::class, 'bd_district_id');
    }

    public function upazila(): BelongsTo
    {
        return $this->belongsTo(BdUpazila::class, 'bd_upazila_id');
    }

    public function stockLevels(): HasMany
    {
        return $this->hasMany(StockLevel::class);
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }
}
