<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable(['store_id', 'name', 'contact_name', 'email', 'phone', 'tracking_url_template', 'status', 'provider', 'api_key', 'api_secret'])]
#[Hidden(['api_key', 'api_secret'])]
class Courier extends Model
{
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'api_key' => 'encrypted',
            'api_secret' => 'encrypted',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Courier $courier) {
            $courier->uuid ??= (string) Str::uuid();
        });
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class);
    }

    public function codSettlements(): HasMany
    {
        return $this->hasMany(CodSettlement::class);
    }
}
