<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Requests\Account\LoginRequest;
use App\Http\Requests\Account\RegisterRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Models\Store;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * Registers a customer — or "claims" one: guest checkout already
     * creates a phone-identified Customer row with no password, and
     * disconnecting that from a fresh signup would orphan the guest's
     * own past orders from the account meant to show them. A phone
     * that's already claimed (has a password) is rejected, not silently
     * overwritten.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $store = Store::where('status', 'active')->firstOrFail();
        $data = $request->validated();

        $customer = Customer::where('store_id', $store->id)->where('phone', $data['phone'])->first();

        if ($customer && $customer->password !== null) {
            return ApiResponse::error('An account with this phone number already exists. Please sign in instead.', [
                'phone' => ['An account with this phone number already exists.'],
            ], 422);
        }

        if ($customer) {
            $customer->update([
                'name' => $data['name'],
                'email' => $data['email'] ?? $customer->email,
                'password' => $data['password'],
            ]);
        } else {
            $customer = Customer::create([
                'store_id' => $store->id,
                'name' => $data['name'],
                'phone' => $data['phone'],
                'email' => $data['email'] ?? null,
                'password' => $data['password'],
                'status' => 'active',
            ]);
        }

        $token = $customer->createToken('account', ['customer', 'store:'.$customer->store_id])->plainTextToken;

        return ApiResponse::success(
            ['customer' => new CustomerResource($customer), 'token' => $token],
            'Registration successful.',
            status: 201,
        );
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $store = Store::where('status', 'active')->firstOrFail();
        $customer = Customer::where('store_id', $store->id)->where('phone', $request->string('phone'))->first();

        if (! $customer || ! $customer->password || ! Hash::check($request->string('password'), $customer->password)) {
            return ApiResponse::error('The provided credentials are incorrect.', [
                'phone' => ['The provided credentials are incorrect.'],
            ], 422);
        }

        if ($customer->status !== 'active') {
            return ApiResponse::error('Your account is not active. Please contact support.', [], 403);
        }

        $token = $customer->createToken('account', ['customer', 'store:'.$customer->store_id])->plainTextToken;

        return ApiResponse::success(
            ['customer' => new CustomerResource($customer), 'token' => $token],
            'Login successful.',
        );
    }

    public function logout(): JsonResponse
    {
        $customer = Auth::user();
        $customer?->currentAccessToken()?->delete();

        return ApiResponse::success(message: 'Logged out successfully.');
    }

    public function me(): JsonResponse
    {
        return ApiResponse::success(new CustomerResource(Auth::user()), 'Current customer fetched successfully.');
    }
}
