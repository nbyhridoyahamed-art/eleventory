<?php

namespace App\Http\Requests\Store;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $storeId = $this->route('store')?->id;

        return [
            'organization_id' => ['required', 'exists:organizations,id'],
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', Rule::unique('stores', 'slug')->ignore($storeId)],
            // No 'domain' here on purpose: a domain routes shoppers to this store, so it may only be
            // attached through the verified flow (DomainController / DomainManager), never typed in.
            'default_currency_id' => ['nullable', 'exists:currencies,id'],
            'default_timezone' => ['nullable', 'string', 'max:64'],
            'default_locale' => ['nullable', 'string', 'max:5'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ];
    }
}
