<?php

namespace App\Rules;

use App\Models\Store;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A store address ("my-shop" in my-shop.<platform>): lowercase letters, digits
 * and single hyphens, 3-40 characters, not reserved and not already taken.
 * Soft-deleted stores still hold their slug so an address is never reused.
 */
class StoreSlug implements ValidationRule
{
    public static function normalize(string $value): string
    {
        return trim(strtolower($value));
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $slug = self::normalize((string) $value);

        if (! preg_match('/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){1,38}[a-z0-9]$/', $slug)) {
            $fail('The store address must be 3-40 characters: lowercase letters, numbers and single hyphens, starting and ending with a letter or number.');

            return;
        }

        if (in_array($slug, config('signup.reserved_slugs', []), true)) {
            $fail('That store address is reserved. Please choose another.');

            return;
        }

        if (Store::withTrashed()->where('slug', $slug)->exists()) {
            $fail('That store address is already taken.');
        }
    }
}
