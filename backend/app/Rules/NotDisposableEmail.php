<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Refuses addresses on throwaway-mailbox domains (see config/signup.php). */
class NotDisposableEmail implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $domain = strtolower(substr(strrchr((string) $value, '@') ?: '', 1));

        if ($domain !== '' && in_array($domain, config('signup.disposable_domains', []), true)) {
            $fail('Please use a permanent email address, not a disposable one.');
        }
    }
}
