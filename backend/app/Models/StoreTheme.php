<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Model;

/** A store's look: the draft being edited and the copy visitors see. See App\Services\Themes\ThemeService. */
class StoreTheme extends Model
{
    use BelongsToStore;

    protected $fillable = ['store_id', 'draft', 'published', 'preview_token', 'published_at'];

    protected $hidden = ['preview_token'];

    protected function casts(): array
    {
        return ['draft' => 'array', 'published' => 'array', 'published_at' => 'datetime'];
    }
}
