<?php

namespace App\Services\Captcha;

use App\Contracts\CaptchaVerifier;

class NullCaptchaVerifier implements CaptchaVerifier
{
    public function passes(?string $token, ?string $ip): bool
    {
        return true;
    }
}
