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
        return ['trial_ends_at' => 'datetime'];
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
}
