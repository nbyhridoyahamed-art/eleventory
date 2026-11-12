<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentAttempt extends Model
{
    use BelongsToStore;

    public const INITIATED = 'initiated';

    public const PAID = 'paid';

    public const FAILED = 'failed';

    public const CANCELLED = 'cancelled';

    public const MISMATCH = 'mismatch';

    protected $fillable = [
        'store_id', 'order_id', 'provider', 'tran_id', 'amount_minor', 'currency_code', 'status',
        'provider_reference', 'refunded_minor', 'test_mode', 'return_url', 'gateway_payload',
    ];

    protected function casts(): array
    {
        return ['amount_minor' => 'integer', 'refunded_minor' => 'integer', 'test_mode' => 'boolean', 'gateway_payload' => 'array'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
