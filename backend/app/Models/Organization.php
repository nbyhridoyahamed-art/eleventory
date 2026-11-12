<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable(['name', 'slug', 'email', 'phone', 'status', 'plan', 'trial_ends_at'])]
class Organization extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['deletion_requested_at' => 'datetime', 'purged_at' => 'datetime', 'trial_ends_at' => 'datetime', 'feature_overrides' => 'array'];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Organization $organization) {
            $organization->uuid ??= (string) Str::uuid();
        });
    }

    public function stores(): HasMany
    {
        return $this->hasMany(Store::class);
    }

    public function subscription(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Subscription::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }
}
