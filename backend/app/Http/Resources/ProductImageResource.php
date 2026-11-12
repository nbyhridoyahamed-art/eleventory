<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Support\MediaLibrary;

class ProductImageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'path' => $this->path,
            'url' => MediaLibrary::url($this->path),
            'alt_text' => $this->alt_text,
            'sort_order' => $this->sort_order,
            'is_primary' => $this->is_primary,
        ];
    }
}
