<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourierResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'store_id' => $this->store_id,
            'name' => $this->name,
            'contact_name' => $this->contact_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'tracking_url_template' => $this->tracking_url_template,
            'status' => $this->status,
            'provider' => $this->provider,
            'has_credentials' => filled($this->api_key) && filled($this->api_secret),
            'shipments_count' => $this->whenCounted('shipments'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
