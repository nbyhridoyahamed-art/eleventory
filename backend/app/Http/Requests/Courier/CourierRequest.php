<?php

namespace App\Http\Requests\Courier;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CourierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'store_id' => ['required', 'exists:stores,id'],
            'name' => ['required', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'tracking_url_template' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'provider' => ['nullable', Rule::in(['manual', 'steadfast'])],
            // Blank on edit keeps the stored secret; required when first connecting.
            'api_key' => [$this->route('courier') ? 'nullable' : 'required_if:provider,steadfast', 'nullable', 'string', 'max:255'],
            'api_secret' => [$this->route('courier') ? 'nullable' : 'required_if:provider,steadfast', 'nullable', 'string', 'max:255'],
        ];
    }
}
