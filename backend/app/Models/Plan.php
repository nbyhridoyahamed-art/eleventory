<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    protected $fillable = [
        'key', 'name', 'description', 'price_monthly', 'price_yearly', 'currency',
        'limits', 'features', 'is_public', 'is_active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price_monthly' => 'decimal:2',
            'price_yearly' => 'decimal:2',
            'limits' => 'array',
            'features' => 'array',
            'is_public' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    /** The cap for one resource: an integer, or null for unlimited (also when the key is absent). */
    public function limit(string $resource): ?int
    {
        $value = $this->limits[$resource] ?? null;

        return $value === null ? null : (int) $value;
    }

    public function feature(string $name): bool
    {
        return (bool) ($this->features[$name] ?? false);
    }

    /** What one billing period costs (yearly falls back to 12 x monthly when no yearly price is set). */
    public function priceFor(string $cycle): string
    {
        if ($cycle === 'yearly') {
            return (string) ($this->price_yearly ?? number_format((float) $this->price_monthly * 12, 2, '.', ''));
        }

        return (string) $this->price_monthly;
    }

    public function scopePurchasable($query)
    {
        return $query->where('is_public', true)->where('is_active', true)->orderBy('sort_order');
    }
}
