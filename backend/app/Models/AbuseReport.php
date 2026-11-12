<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AbuseReport extends Model
{
    public const REASONS = ['spam', 'fraud', 'illegal', 'counterfeit', 'other'];

    protected $fillable = ['store_id', 'url', 'reason', 'details', 'reporter_email', 'status', 'resolution_note', 'resolved_by', 'resolved_at'];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }
}
