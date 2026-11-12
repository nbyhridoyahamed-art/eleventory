<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An account's plan and its billing state:
 * trialing -> active -> past_due -> suspended -> cancelled.
 */
class Subscription extends Model
{
    public const TRIALING = 'trialing';

    public const ACTIVE = 'active';

    public const PAST_DUE = 'past_due';

    public const SUSPENDED = 'suspended';

    public const CANCELLED = 'cancelled';

    protected $fillable = [
        'organization_id', 'plan_id', 'pending_plan_id', 'status', 'billing_cycle', 'trial_ends_at',
        'current_period_start', 'current_period_end', 'grace_ends_at', 'cancel_at_period_end',
        'cancelled_at', 'gateway',
    ];

    protected function casts(): array
    {
        return [
            'trial_ends_at' => 'datetime',
            'current_period_start' => 'datetime',
            'current_period_end' => 'datetime',
            'grace_ends_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'cancel_at_period_end' => 'boolean',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function pendingPlan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'pending_plan_id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /** May the account use the admin and keep its shops open? Past-due still can: that is the grace period. */
    public function isInGoodStanding(): bool
    {
        return in_array($this->status, [self::TRIALING, self::ACTIVE, self::PAST_DUE], true);
    }

    /** Does this account stand on a paid (or complimentary) plan rather than a trial? */
    public function isPaid(): bool
    {
        return $this->status !== self::TRIALING;
    }
}
