export type ShipmentStatus =
  | "pending_pickup"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "failed_delivery"
  | "returned_to_seller";

export interface ShipmentStatusHistoryEntry {
  from_status: ShipmentStatus | null;
  to_status: ShipmentStatus;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Shipment {
  id: number;
  uuid: string;
  tracking_number: string;
  status: ShipmentStatus;
  delivery_charge: number;
  cod_amount_collected: number | null;
  cod_settled: boolean;
  delivered_at: string | null;
  notes: string | null;
  order: {
    id: number;
    order_number: string;
    status: string;
    payment_method: string;
    customer_name: string | null;
    shipping_recipient_name: string;
    shipping_phone: string;
    shipping_address_line: string;
  };
  courier: { id: number; name: string; provider?: string };
  external_id?: string | null;
  courier_status?: string | null;
  tracking_url?: string;
  status_history: ShipmentStatusHistoryEntry[];
  created_by: string | null;
  created_at: string;
}
