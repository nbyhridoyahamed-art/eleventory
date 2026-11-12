<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A custom domain a store wants to be served on. Only `active` ones (ownership
 * proven by a DNS TXT record) route traffic.
 */
class StoreDomain extends Model
{
    use BelongsToStore, HasFactory;

    public const PENDING = 'pending';

    public const ACTIVE = 'active';

    public const FAILED = 'failed';

    protected $fillable = [
        'store_id', 'domain', 'status', 'verification_token', 'active_domain', 'is_primary',
        'points_here', 'verified_at', 'last_checked_at', 'last_error',
    ];

    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
            'points_here' => 'boolean',
            'verified_at' => 'datetime',
            'last_checked_at' => 'datetime',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function isActive(): bool
    {
        return $this->status === self::ACTIVE;
    }

    /** DNS name of the ownership TXT record. */
    public function txtName(): string
    {
        return '_eleventory.'.$this->domain;
    }

    /** Value the ownership TXT record must contain. */
    public function txtValue(): string
    {
        return 'eleventory-verify='.$this->verification_token;
    }
}
