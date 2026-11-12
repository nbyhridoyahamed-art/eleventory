<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Proof that a person accepted a version of a legal document, and when. Append-only. */
class LegalAcceptance extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'document', 'version', 'accepted_at', 'ip'];

    protected function casts(): array
    {
        return ['accepted_at' => 'datetime'];
    }
}
