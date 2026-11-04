<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['store_id', 'name', 'bd_division_id', 'bd_district_id', 'status'])]
class DeliveryZone extends Model
{
    use BelongsToStore;
    use HasFactory;

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

    public function rates(): HasMany
    {
        return $this->hasMany(DeliveryZoneRate::class)->orderBy('min_order_subtotal_amount');
    }
}
