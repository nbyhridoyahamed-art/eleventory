<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

#[Fillable(['store_id', 'name', 'type', 'settings', 'styles', 'responsive', 'visibility', 'animation', 'created_by'])]
class SavedSection extends Model
{
    use BelongsToStore;
    use HasFactory;

    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'styles' => 'array',
            'responsive' => 'array',
            'visibility' => 'array',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (SavedSection $section) {
            $section->uuid ??= (string) Str::uuid();
        });
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }
}
