<?php

namespace App\Http\Requests\Storefront;

use App\Rules\BdPhone;
use App\Rules\VariantBelongsToProduct;
use App\Support\BdPhoneNumber;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Deliberately has no unit_price field at any level — a guest's price for
 * a cart line is never accepted, only product_id/product_variant_id/
 * quantity, so CheckoutController must always compute price itself from
 * the current catalog. There's also no payment_method (Wave 1 is COD-only,
 * hardcoded server-side) and no customer_address_id — checkout always
 * collects a fresh shipping address, even for a customer now signed in
 * (Phase 17 Wave 1); offering their saved-address book here instead is a
 * real, separate integration left for its own pass, not bundled in just
 * because the two features are related.
 */
class CheckoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        // customer_phone is the identity CheckoutController::firstOrCreate()s
        // a Customer by, and the same field Phase 17's account registration
        // matches an existing guest checkout against to "claim" it — both
        // sides must normalize identically or that match silently fails.
        // shipping_phone is just the delivery contact, not an identity key,
        // so it stays as freely entered as the admin order form's own
        // shipping_phone.
        if ($this->filled('customer_phone')) {
            $this->merge(['customer_phone' => BdPhoneNumber::normalize($this->string('customer_phone')) ?? $this->input('customer_phone')]);
        }
    }

    public function rules(): array
    {
        return [
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_phone' => ['required', 'string', new BdPhone],
            'customer_email' => ['nullable', 'email', 'max:255'],

            'shipping_recipient_name' => ['required', 'string', 'max:255'],
            'shipping_phone' => ['required', 'string', 'max:20'],
            'shipping_address_line' => ['required', 'string'],
            'shipping_bd_division_id' => ['nullable', 'exists:bd_divisions,id'],
            'shipping_bd_district_id' => ['nullable', 'exists:bd_districts,id'],
            'shipping_bd_upazila_id' => ['nullable', 'exists:bd_upazilas,id'],

            'notes' => ['nullable', 'string', 'max:1000'],
            'coupon_code' => ['nullable', 'string', 'max:50'],
            // "cod" (the default) or the key of an online method the store has switched on;
            // CheckoutController refuses anything the store does not offer.
            'payment_method' => ['nullable', 'string', 'max:30'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.product_variant_id' => ['nullable', 'integer', new VariantBelongsToProduct],
            // Capped well above any realistic cart line — this is the first
            // public unauthenticated write endpoint in the app, so a guard
            // against an absurd quantity griefing a warehouse's reservation
            // is cheap insurance the trusted admin form doesn't need.
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $lines = array_map(
                fn (array $item) => ($item['product_id'] ?? '').':'.($item['product_variant_id'] ?? ''),
                $this->input('items', []),
            );
            if (count($lines) !== count(array_unique($lines))) {
                $validator->errors()->add('items', 'Each product (or product variant) may only appear once in your cart.');
            }
        });
    }
}
