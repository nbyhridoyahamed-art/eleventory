<?php

namespace App\Support;

use App\Models\Product;
use Illuminate\Support\Str;

/**
 * Builds the next free SKU for a store as PREFIX-000123, where PREFIX is the
 * first three letters of the brand (else the category, else "PRD") and the
 * number continues the highest one already used with that prefix.
 */
class SkuGenerator
{
    public static function generate(int $storeId, ?string $brandName = null, ?string $categoryName = null): string
    {
        $prefix = self::prefix($brandName) ?? self::prefix($categoryName) ?? 'PRD';

        // Soft-deleted products keep their SKU reserved (the unique index still sees them).
        $highest = Product::withTrashed()
            ->where('store_id', $storeId)
            ->where('sku', 'like', $prefix.'-%')
            ->pluck('sku')
            ->map(fn (string $sku) => preg_match('/^'.preg_quote($prefix, '/').'-(\d+)$/', $sku, $m) ? (int) $m[1] : 0)
            ->max() ?? 0;

        do {
            $highest++;
            $sku = sprintf('%s-%06d', $prefix, $highest);
        } while (Product::withTrashed()->where('store_id', $storeId)->where('sku', $sku)->exists());

        return $sku;
    }

    private static function prefix(?string $name): ?string
    {
        if ($name === null) {
            return null;
        }

        $letters = preg_replace('/[^A-Z0-9]/', '', strtoupper(Str::ascii($name))) ?? '';

        return strlen($letters) >= 2 ? substr($letters, 0, 3) : null;
    }
}
