<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    public const OPEN = 'open';

    public const PAID = 'paid';

    public const VOID = 'void';

    public const FAILED = 'failed';

    protected $fillable = [
        'organization_id', 'subscription_id', 'plan_id', 'number', 'status', 'billing_cycle', 'amount',
        'currency', 'description', 'period_start', 'period_end', 'due_at', 'paid_at', 'gateway',
        'tran_id', 'gateway_payload',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'period_start' => 'datetime',
            'period_end' => 'datetime',
            'due_at' => 'datetime',
            'paid_at' => 'datetime',
            'gateway_payload' => 'array',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function isOpen(): bool
    {
        return $this->status === self::OPEN;
    }
}
