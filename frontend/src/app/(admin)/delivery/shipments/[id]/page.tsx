"use client";

import { use } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useShipment } from "@/hooks/use-shipments";
import { PermissionDenied } from "@/components/permission-denied";
import { ShipmentStatusCard } from "@/components/delivery/shipment-status-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ShipmentStatus } from "@/types/shipment";

type BadgeVariant = BadgeProps["variant"];

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending_pickup: "Pending pickup",
  picked_up: "Picked up",
  in_transit: "In transit",
  delivered: "Delivered",
  failed_delivery: "Failed delivery",
  returned_to_seller: "Returned to seller",
};

const STATUS_VARIANTS: Record<ShipmentStatus, BadgeVariant> = {
  pending_pickup: "neutral",
  picked_up: "info",
  in_transit: "info",
  delivered: "success",
  failed_delivery: "danger",
  returned_to_seller: "warning",
};

export default function ShipmentShowPage({ params }: PageProps<"/delivery/shipments/[id]">) {
  const { id } = use(params);
  const shipmentId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const { data: shipment, isLoading, isError } = useShipment(shipmentId);

  if (currentUser && !can(currentUser, "shipments.view")) {
    return <PermissionDenied />;
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (isError || !shipment) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this shipment. It may not exist.</AlertDescription>
      </Alert>
    );
  }

  const canUpdate = can(currentUser, "shipments.update");

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/delivery/shipments">
          <ArrowLeft />
          Back to shipments
        </Link>
      </Button>

      <ShipmentStatusCard shipment={shipment} canUpdate={canUpdate} />

      <Card>
        <CardHeader>
          <CardTitle>Order</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-text-muted">Order</p>
            <Link href={`/orders/orders/${shipment.order.id}`} className="font-medium text-primary hover:underline">
              {shipment.order.order_number}
            </Link>
          </div>
          <div>
            <p className="text-text-muted">Customer</p>
            <p className="font-medium text-text-primary">{shipment.order.customer_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-text-muted">Shipping to</p>
            <p className="font-medium text-text-primary">{shipment.order.shipping_recipient_name}</p>
            <p className="text-text-secondary">{shipment.order.shipping_phone}</p>
            <p className="text-text-secondary">{shipment.order.shipping_address_line}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status history</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {shipment.status_history.map((entry, index) => (
              <li key={index} className="flex items-center justify-between text-sm">
                <div>
                  <Badge variant={STATUS_VARIANTS[entry.to_status]}>{STATUS_LABELS[entry.to_status]}</Badge>
                  {entry.note ? <span className="ml-2 text-text-secondary">{entry.note}</span> : null}
                </div>
                <div className="text-right text-text-muted">
                  <p>{new Date(entry.created_at).toLocaleString()}</p>
                  {entry.created_by ? <p>{entry.created_by}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
