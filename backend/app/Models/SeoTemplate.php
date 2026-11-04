<?php

namespace App\Models;

use App\Models\Concerns\BelongsToStore;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['store_id', 'entity_type', 'title_template', 'description_template'])]
class SeoTemplate extends Model
{
    use BelongsToStore;
    use HasFactory;

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }
}
