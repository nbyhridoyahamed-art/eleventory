<?php

namespace App\Http\Resources;

use App\Support\CustomerSegment;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'store_id' => $this->store_id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'status' => $this->status,
            'has_account' => $this->password !== null,
            'orders_count' => $this->whenCounted('orders'),
            // Only present when the controller eager-sums it (index/show) —
            // never a stored column, see Customer::storeCreditBalance().
            'store_credit_balance' => $this->store_credit_balance_minor === null
                ? null
                : (new Money((int) $this->store_credit_balance_minor, 'BDT'))->toDecimal(),
            // Only present on the list (aggregated in SQL); cancelled orders are excluded.
            'lifetime_spend' => $this->when(isset($this->lifetime_spend_minor), fn () => (new Money((int) $this->lifetime_spend_minor, 'BDT'))->toDecimal()),
            'average_order_value' => $this->when(
                isset($this->lifetime_spend_minor) && (int) ($this->active_orders_count ?? 0) > 0,
                fn () => (new Money((int) round($this->lifetime_spend_minor / $this->active_orders_count), 'BDT'))->toDecimal(),
            ),
            'active_orders_count' => $this->when(isset($this->active_orders_count), fn () => (int) $this->active_orders_count),
            'last_order_at' => $this->when(isset($this->active_orders_count), fn () => $this->last_order_at),
            'segment' => $this->when(isset($this->active_orders_count), fn () => CustomerSegment::label(
                (int) $this->active_orders_count,
                (int) $this->lifetime_spend_minor,
                $this->last_order_at,
            )),
            'addresses' => CustomerAddressResource::collection($this->whenLoaded('addresses')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
