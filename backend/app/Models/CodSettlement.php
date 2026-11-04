<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

#[Fillable(['store_id', 'courier_id', 'settlement_number', 'amount_expected', 'amount_received', 'note', 'created_by'])]
class CodSettlement extends Model
{
    use BelongsToStore;
    use HasFactory;

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (CodSettlement $settlement) {
            $settlement->uuid ??= (string) Str::uuid();
        });
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function courier(): BelongsTo
    {
        return $this->belongsTo(Courier::class);
    }

    public function shipments(): BelongsToMany
    {
        return $this->belongsToMany(Shipment::class, 'cod_settlement_shipments');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
