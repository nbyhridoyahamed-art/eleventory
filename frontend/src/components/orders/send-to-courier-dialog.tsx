"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useAllCouriers } from "@/hooks/use-couriers";
import { ApiError } from "@/types/api";
import type { Order } from "@/types/order";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface SendToCourierDialogProps {
  order: Order | null;
  storeId: number | null | undefined;
  onClose: () => void;
}

/**
 * One step "send to courier" for the orders list: hands the order to a courier
 * and records the shipment. A pending or processing order is shipped first
 * (which takes its stock out), then the shipment is created against it.
 */
export function SendToCourierDialog({ order, storeId, onClose }: SendToCourierDialogProps) {
  const queryClient = useQueryClient();
  const { data: couriersData } = useAllCouriers(order ? storeId : null);
  const couriers = (couriersData?.data ?? []).filter((courier) => courier.status === "active");

  const [courierId, setCourierId] = useState("");
  const [tracking, setTracking] = useState("");
  const [charge, setCharge] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = couriers.find((courier) => String(courier.id) === courierId);
  const viaApi = selected?.provider === "steadfast";

  // Reset the form each time a different order is opened.
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  if (order && order.id !== lastOrderId) {
    setLastOrderId(order.id);
    setCourierId("");
    setTracking("");
    setCharge("");
    setNotes("");
  }

  async function submit() {
    if (!order) return;
    setBusy(true);

    try {
      if (order.status === "pending" || order.status === "processing") {
        await api.post(`/orders/${order.id}/ship`);
      }

      if (viaApi) {
        await api.post(`/orders/${order.id}/send-to-courier`, {
          courier_id: Number(courierId),
          note: notes.trim() === "" ? null : notes.trim(),
        });
      } else {
        await api.post(`/orders/${order.id}/shipments`, {
          courier_id: Number(courierId),
          tracking_number: tracking.trim(),
          delivery_charge: charge.trim() === "" ? null : charge.trim(),
          notes: notes.trim() === "" ? null : notes.trim(),
        });
      }

      toast.success(`${order.order_number} sent to courier.`);
      onClose();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not send this order to the courier.");
    } finally {
      // Refresh either way: the ship step may have succeeded even if the shipment step failed.
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      setBusy(false);
    }
  }

  const needsShipping = order?.status === "pending" || order?.status === "processing";

  return (
    <Dialog open={order !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to courier</DialogTitle>
          <DialogDescription>
            {order ? (
              <>
                {order.order_number} · {order.customer.name}
                {needsShipping ? " — it will be marked as shipped and its stock deducted." : ""}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="courier-select">Courier</Label>
            <Select value={courierId} onValueChange={setCourierId}>
              <SelectTrigger id="courier-select" aria-label="Courier">
                <SelectValue placeholder={couriers.length === 0 ? "No active couriers — add one in Delivery" : "Choose a courier"} />
              </SelectTrigger>
              <SelectContent>
                {couriers.map((courier) => (
                  <SelectItem key={courier.id} value={String(courier.id)}>
                    {courier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {viaApi ? (
            <p className="rounded-md bg-shop-tint p-3 text-xs text-text-secondary">
              The parcel is booked with Steadfast right now. Its tracking code is saved automatically, and the amount to
              collect is the unpaid balance for cash-on-delivery orders.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="courier-tracking">Tracking / consignment number</Label>
                <Input
                  id="courier-tracking"
                  value={tracking}
                  placeholder="e.g. SF123456789"
                  onChange={(event) => setTracking(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="courier-charge">Delivery charge (optional)</Label>
                <Input
                  id="courier-charge"
                  inputMode="decimal"
                  value={charge}
                  placeholder="Defaults to the order's shipping amount"
                  onChange={(event) => setCharge(event.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="courier-notes">Note for the courier (optional)</Label>
            <Textarea id="courier-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={courierId === "" || (!viaApi && tracking.trim() === "")} onClick={submit}>
            {viaApi ? "Send to Steadfast" : "Send to courier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
