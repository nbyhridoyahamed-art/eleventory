<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['homepage_block_id', 'store_id', 'snapshot', 'created_by'])]
class HomepageBlockRevision extends Model
{
    use BelongsToStore;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'snapshot' => 'array',
            'created_at' => 'datetime',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (HomepageBlockRevision $revision) {
            $revision->created_at ??= now();
        });
    }

    public function block(): BelongsTo
    {
        return $this->belongsTo(HomepageBlock::class, 'homepage_block_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
