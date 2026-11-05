<?php

namespace App\Http\Requests\Auth;

use App\Rules\BdPhone;
use App\Rules\NotDisposableEmail;
use App\Rules\StoreSlug;
use App\Support\BdPhoneNumber;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class MerchantSignupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('phone')) {
            $this->merge(['phone' => BdPhoneNumber::normalize($this->string('phone')) ?? $this->input('phone')]);
        }

        if ($this->filled('store_slug')) {
            $this->merge(['store_slug' => StoreSlug::normalize((string) $this->input('store_slug'))]);
        }

        if ($this->filled('email')) {
            $this->merge(['email' => strtolower(trim((string) $this->input('email')))]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email', new NotDisposableEmail],
            'phone' => ['nullable', 'string', new BdPhone, 'unique:users,phone'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'store_name' => ['required', 'string', 'min:2', 'max:80'],
            'store_slug' => ['required', 'string', new StoreSlug],
            'accept_terms' => ['accepted'],
            'captcha_token' => ['nullable', 'string', 'max:2048'],
        ];
    }
}
