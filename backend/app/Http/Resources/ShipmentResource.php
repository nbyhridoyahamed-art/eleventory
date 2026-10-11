<?php

namespace App\Http\Resources;

use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShipmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $currencyCode = $this->relationLoaded('order') ? $this->order->currency_code : 'BDT';

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'tracking_number' => $this->tracking_number,
            'status' => $this->status,
            'external_id' => $this->external_id,
            'courier_status' => $this->courier_status,
            'delivery_charge' => (new Money($this->delivery_charge_amount, $currencyCode))->toDecimal(),
            'cod_amount_collected' => $this->cod_amount_collected === null
                ? null
                : (new Money($this->cod_amount_collected, $currencyCode))->toDecimal(),
            'cod_settled' => $this->cod_settled,
            'delivered_at' => $this->delivered_at,
            'notes' => $this->notes,
            'order' => $this->whenLoaded('order', fn () => [
                'id' => $this->order->id,
                'order_number' => $this->order->order_number,
                'status' => $this->order->status,
                'payment_method' => $this->order->payment_method,
                'customer_name' => $this->order->customer?->name,
                'shipping_recipient_name' => $this->order->shipping_recipient_name,
                'shipping_phone' => $this->order->shipping_phone,
                'shipping_address_line' => $this->order->shipping_address_line,
            ]),
            'courier' => $this->whenLoaded('courier', fn () => [
                'id' => $this->courier->id,
                'name' => $this->courier->name,
                'provider' => $this->courier->provider,
            ]),
            'tracking_url' => $this->when(
                $this->relationLoaded('courier') && $this->courier?->tracking_url_template,
                fn () => str_replace('{tracking_number}', $this->tracking_number, $this->courier->tracking_url_template),
            ),
            'status_history' => $this->whenLoaded('statusHistory', fn () => $this->statusHistory->map(fn ($entry) => [
                'from_status' => $entry->from_status,
                'to_status' => $entry->to_status,
                'note' => $entry->note,
                'created_by' => $entry->creator?->name,
                'created_at' => $entry->created_at,
            ])),
            'created_by' => $this->creator?->name,
            'created_at' => $this->created_at,
        ];
    }
}
