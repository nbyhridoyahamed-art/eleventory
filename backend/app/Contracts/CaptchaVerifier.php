<?php

namespace App\Contracts;

/**
 * The bot check in front of public sign-up. Bind a real provider (Turnstile,
 * hCaptcha, reCAPTCHA) here when abuse starts; the default accepts everyone.
 */
interface CaptchaVerifier
{
    public function passes(?string $token, ?string $ip): bool;
}
