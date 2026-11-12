<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;

/** A zip of one shop's data made for its owner. The file lives on the private disk until it expires. */
class DataExport extends Model
{
    use BelongsToStore;

    protected $fillable = ['store_id', 'requested_by', 'status', 'path', 'size', 'expires_at'];

    protected $hidden = ['path'];

    protected function casts(): array
    {
        return ['size' => 'integer', 'expires_at' => 'datetime'];
    }

    public function isDownloadable(): bool
    {
        return $this->status === 'ready' && $this->path && $this->expires_at?->isFuture();
    }
}
