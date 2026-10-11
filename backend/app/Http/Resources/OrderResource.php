<?php

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $subtotalMinor = $this->relationLoaded('items')
            ? $this->items->sum(fn ($item) => $item->quantity * $item->unit_price_amount)
            : null;

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'order_number' => $this->order_number,
            'status' => $this->status,
            'payment_method' => $this->payment_method,
            'payment_status' => $this->payment_status,
            'source' => $this->source,
            'currency_code' => $this->currency_code,
            'notes' => $this->notes,
            'customer' => $this->whenLoaded('customer', fn () => [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'phone' => $this->customer->phone,
            ]),
            'warehouse' => $this->whenLoaded('warehouse', fn () => ['id' => $this->warehouse->id, 'name' => $this->warehouse->name]),
            'shipping' => [
                'customer_address_id' => $this->customer_address_id,
                'recipient_name' => $this->shipping_recipient_name,
                'phone' => $this->shipping_phone,
                'address_line' => $this->shipping_address_line,
                // Raw ids alongside the resolved names — the order-edit form
                // needs these to prefill its cascading division/district/
                // upazila Selects, the same pair CustomerAddressResource
                // already exposes for the identical reason.
                'bd_division_id' => $this->shipping_bd_division_id,
                'bd_district_id' => $this->shipping_bd_district_id,
                'bd_upazila_id' => $this->shipping_bd_upazila_id,
                'division' => $this->whenLoaded('shippingDivision', fn () => $this->shippingDivision?->name_en),
                'district' => $this->whenLoaded('shippingDistrict', fn () => $this->shippingDistrict?->name_en),
                'upazila' => $this->whenLoaded('shippingUpazila', fn () => $this->shippingUpazila?->name_en),
            ],
            'shipping_amount' => (new Money($this->shipping_amount, $this->currency_code))->toDecimal(),
            'discount_amount' => (new Money($this->discount_amount, $this->currency_code))->toDecimal(),
            'store_credit_amount' => (new Money($this->store_credit_amount, $this->currency_code))->toDecimal(),
            'coupon_code' => $this->whenLoaded('couponUsage', fn () => $this->couponUsage?->code),
            'source_return' => $this->whenLoaded('sourceReturn', fn () => $this->sourceReturn ? [
                'id' => $this->sourceReturn->id,
                'return_number' => $this->sourceReturn->return_number,
            ] : null),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product->name,
                'sku' => $item->product->sku,
                'product_variant' => $item->product_variant_id ? [
                    'id' => $item->productVariant->id,
                    'sku' => $item->productVariant->sku,
                    'attribute_values' => $item->productVariant->attributeValues->map(fn ($value) => [
                        'attribute_name' => $value->attribute->name,
                        'value' => $value->value,
                    ]),
                ] : null,
                'quantity' => $item->quantity,
                'unit_price' => (new Money($item->unit_price_amount, $this->currency_code))->toDecimal(),
                'line_total' => (new Money($item->quantity * $item->unit_price_amount, $this->currency_code))->toDecimal(),
                // Only meaningful for a bundle line — what actually gets
                // packed/decremented, for staff/packing visibility.
                'components' => $item->product->type === 'bundle' ? $item->components->map(fn ($component) => [
                    'product_id' => $component->product_id,
                    'product_name' => $component->product->name,
                    'sku' => $component->product->sku,
                    'product_variant_sku' => $component->productVariant?->sku,
                    'quantity' => $component->quantity,
                ]) : null,
            ])),
            'subtotal_amount' => $subtotalMinor === null ? null : (new Money($subtotalMinor, $this->currency_code))->toDecimal(),
            'total_amount' => $subtotalMinor === null ? null : (new Money(
                $subtotalMinor + $this->shipping_amount - $this->discount_amount - $this->store_credit_amount,
                $this->currency_code,
            ))->toDecimal(),
            'status_history' => $this->whenLoaded('statusHistory', fn () => $this->statusHistory->map(fn ($entry) => [
                'from_status' => $entry->from_status,
                'to_status' => $entry->to_status,
                'note' => $entry->note,
                'created_by' => $entry->creator?->name,
                'created_at' => $entry->created_at,
            ])),
            'shipments' => $this->whenLoaded('shipments', fn () => $this->shipments->map(fn ($shipment) => [
                'id' => $shipment->id,
                'tracking_number' => $shipment->tracking_number,
                'status' => $shipment->status,
                'courier_name' => $shipment->courier?->name,
                'courier_status' => $shipment->courier_status,
                'courier_provider' => $shipment->courier?->provider,
                'created_at' => $shipment->created_at,
            ])),
            'returns' => $this->whenLoaded('returns', fn () => $this->returns->map(fn ($return) => [
                'id' => $return->id,
                'return_number' => $return->return_number,
                'status' => $return->status,
                'refund_amount' => $return->refund_amount === null ? null : (new Money($return->refund_amount, $this->currency_code))->toDecimal(),
            ])),
            'payments' => $this->whenLoaded('payments', fn () => $this->payments->map(fn ($payment) => [
                'id' => $payment->id,
                'amount' => (new Money($payment->amount_amount, $payment->currency_code))->toDecimal(),
                'currency_code' => $payment->currency_code,
                'method' => $payment->method,
                'reference' => $payment->reference,
                'note' => $payment->note,
                'created_by' => $payment->creator?->name,
                'created_at' => $payment->created_at,
            ])),
            'created_by' => $this->creator?->name,
            'created_at' => $this->created_at,
        ];
    }
}
