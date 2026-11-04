<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Deliberately no SoftDeletes: MediaController::destroy() removes the
 * physical file too (the whole point of deleting an entry from the
 * library), so a soft-deleted row promising recoverability while its file
 * is already permanently gone would be misleading, not a real safety net.
 */
#[Fillable(['store_id', 'disk', 'path', 'filename', 'mime_type', 'size', 'alt_text', 'uploaded_by'])]
class Media extends Model
{
    use BelongsToStore;
    use HasFactory;

    protected function casts(): array
    {
        return [
            'size' => 'integer',
        ];
    }

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Media $media) {
            $media->uuid ??= (string) Str::uuid();
        });
    }

    public function url(): string
    {
        return Storage::disk($this->disk)->url($this->path);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
