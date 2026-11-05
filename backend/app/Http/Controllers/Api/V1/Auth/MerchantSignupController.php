<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\RegisterUserAction;
use App\Contracts\CaptchaVerifier;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\MerchantSignupRequest;
use App\Notifications\VerifyStaffEmailNotification;
use App\Rules\StoreSlug;
use App\Services\Tenancy\StoreProvisioner;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Throwable;

/**
 * Public sign-up for merchants: one request creates the person, their
 * organization and a ready-to-use store. Closed unless MERCHANT_SIGNUP is on,
 * and only available in multi-tenant mode, because a store owner's role would
 * otherwise reach the single store's shared roles and settings.
 */
class MerchantSignupController extends Controller
{
    public function signup(
        MerchantSignupRequest $request,
        RegisterUserAction $register,
        StoreProvisioner $provisioner,
        CaptchaVerifier $captcha,
    ): JsonResponse {
        if (! config('app.merchant_signup') || ! config('app.saas_mode')) {
            return ApiResponse::error('Sign-up is not open yet.', [], 403);
        }

        if (! $captcha->passes($request->input('captcha_token'), $request->ip())) {
            return ApiResponse::error('Please complete the verification check and try again.', ['captcha_token' => ['Verification failed.']], 422);
        }

        $data = $request->validated();
        $user = $register->execute($data);
        $store = $provisioner->provision($user, $data['store_name'], $data['store_slug']);

        $sent = $this->sendVerification($user);

        return ApiResponse::success(
            [
                'email' => $user->email,
                'store' => ['name' => $store->name, 'slug' => $store->slug],
                'verification_sent' => $sent,
            ],
            $sent
                ? 'Your store is ready. Check your email for the verification link to sign in.'
                : 'Your store is ready, but the verification email could not be sent. Use "Resend verification" on the sign-in page.',
            status: 201,
        );
    }

    /** Lets the sign-up form say "taken" before the person presses the button. */
    public function slugAvailable(Request $request): JsonResponse
    {
        $slug = StoreSlug::normalize((string) $request->query('slug', ''));

        $validator = Validator::make(['slug' => $slug], ['slug' => ['required', 'string', new StoreSlug]]);

        return ApiResponse::success([
            'slug' => $slug,
            'available' => ! $validator->fails(),
            'reason' => $validator->fails() ? $validator->errors()->first('slug') : null,
        ]);
    }

    private function sendVerification($user): bool
    {
        try {
            $user->notify(new VerifyStaffEmailNotification);

            return true;
        } catch (Throwable $e) {
            report($e);

            return false;
        }
    }
}
