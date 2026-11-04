<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

/**
 * Extends the same Authenticatable base + HasApiTokens as User (Phase 17),
 * so a customer can hold their own Sanctum tokens — deliberately a
 * separate model/token space from staff, never the same guard: see
 * EnsureCustomerUser/EnsureStaffUser and DATABASE_DESIGN.md section 1o.
 * password is nullable — null means a guest-checkout-only record; Phase
 * 17 registration "claims" one by phone rather than creating a second,
 * disconnected row for the same customer.
 */
#[Fillable(['store_id', 'name', 'email', 'phone', 'password', 'status'])]
#[Hidden(['password'])]
class Customer extends Authenticatable
{
    use BelongsToStore;
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected function casts(): array
    {
        return ['password' => 'hashed'];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Customer $customer) {
            $customer->uuid ??= (string) Str::uuid();
        });
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(CustomerAddress::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function storeCredits(): HasMany
    {
        return $this->hasMany(CustomerStoreCredit::class);
    }

    /** Never stored — always the running sum of the ledger, same rule as Order::totalAmount(). */
    public function storeCreditBalance(): int
    {
        return (int) $this->storeCredits()->sum('amount');
    }
}
