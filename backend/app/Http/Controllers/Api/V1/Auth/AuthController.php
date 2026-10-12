<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\RegisterUserAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Notifications\VerifyStaffEmailNotification;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Password;
use Throwable;

class AuthController extends Controller
{
    public function __construct(private readonly RegisterUserAction $registerUserAction) {}

    /**
     * Open sign-up for the admin area. The account starts unverified and
     * without any role: it cannot sign in until the emailed link is opened,
     * and even then sees nothing until an administrator assigns a role.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        if (! config('app.staff_registration')) {
            return ApiResponse::error('Registration is currently closed. Ask an administrator for an account.', [], 403);
        }

        $user = $this->registerUserAction->execute($request->validated());

        $sent = $this->sendVerification($user);

        return ApiResponse::success(
            ['email' => $user->email, 'verification_sent' => $sent],
            $sent
                ? 'Account created. Check your email for the verification link.'
                : 'Account created, but the verification email could not be sent. Ask an administrator to verify your account.',
            status: 201,
        );
    }

    /** Opened from the emailed link: marks the address verified, then sends the person to the sign-in page. */
    public function verifyEmail(Request $request, int $id, string $hash): RedirectResponse
    {
        $login = rtrim((string) config('app.frontend_url'), '/').'/login';
        $user = User::find($id);

        if (! $user || ! hash_equals(sha1((string) $user->email), $hash)) {
            return redirect()->away($login.'?verified=invalid');
        }

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        return redirect()->away($login.'?verified=1');
    }

    /** Always answers the same way, so it cannot be used to discover which addresses are registered. */
    public function resendVerification(Request $request): JsonResponse
    {
        $email = (string) $request->validate(['email' => ['required', 'email']])['email'];
        $user = User::where('email', $email)->whereNull('email_verified_at')->first();

        if ($user) {
            $this->sendVerification($user);
        }

        return ApiResponse::success(message: 'If that address has an unverified account, a new link is on its way.');
    }

    private function sendVerification(User $user): bool
    {
        try {
            $user->notify(new VerifyStaffEmailNotification);

            return true;
        } catch (Throwable $e) {
            report($e);

            return false;
        }
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->string('email'))->first();

        if (! $user || ! Auth::getProvider()->validateCredentials($user, $request->only('password'))) {
            return ApiResponse::error('The provided credentials are incorrect.', [
                'email' => ['The provided credentials are incorrect.'],
            ], 422);
        }

        if ($user->status !== 'active') {
            return ApiResponse::error('Your account is not active. Please contact support.', [], 403);
        }

        if ($user->email_verified_at === null) {
            return ApiResponse::error('Please verify your email address first - check your inbox for the link.', [
                'code' => ['email_unverified'],
            ], 403);
        }

        $token = $user->createToken('api')->plainTextToken;

        return ApiResponse::success(
            ['user' => new UserResource($user->load('roles')), 'token' => $token],
            'Login successful.',
        );
    }

    public function logout(): JsonResponse
    {
        $user = Auth::user();
        $user?->currentAccessToken()?->delete();

        return ApiResponse::success(message: 'Logged out successfully.');
    }

    public function me(): JsonResponse
    {
        $user = Auth::user()->load(['roles', 'currentStore']);

        return ApiResponse::success(new UserResource($user), 'Current user fetched successfully.');
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $status = Password::sendResetLink($request->only('email'));

        if ($status !== Password::RESET_LINK_SENT) {
            return ApiResponse::error('Unable to send the reset link.', [
                'email' => [__($status)],
            ], 422);
        }

        return ApiResponse::success(message: 'Password reset link sent to your email.');
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();
                $user->tokens()->delete();
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            return ApiResponse::error('Unable to reset the password.', [
                'email' => [__($status)],
            ], 422);
        }

        return ApiResponse::success(message: 'Password reset successfully.');
    }
}
