"use client";

import { useState } from "react";
import { Ban, CheckCircle2, PackageCheck, RotateCcw } from "lucide-react";
import Link from "next/link";

import { useApproveReturn, useReceiveReturn, useRefundReturn, useRejectReturn } from "@/hooks/use-returns";
import { formatMoney } from "@/lib/money";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { OrderReturn, RefundMethod, ReturnStatus } from "@/types/return";

type BadgeVariant = BadgeProps["variant"];

const STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  received: "Received",
  refunded: "Refunded",
};

const STATUS_VARIANTS: Record<ReturnStatus, BadgeVariant> = {
  requested: "neutral",
  approved: "info",
  rejected: "danger",
  received: "warning",
  refunded: "success",
};

const REFUND_METHOD_LABELS: Record<RefundMethod, string> = {
  original_payment: "Original payment method",
  store_credit: "Store credit",
};

interface ReturnStatusCardProps {
  orderReturn: OrderReturn;
  currencyCode: string;
  canUpdate: boolean;
}

export function ReturnStatusCard({ orderReturn, currencyCode, canUpdate }: ReturnStatusCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [note, setNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("original_payment");
  const [restockByItem, setRestockByItem] = useState<Record<number, boolean>>({});

  const approve = useApproveReturn(orderReturn.id);
  const reject = useRejectReturn(orderReturn.id);
  const receive = useReceiveReturn(orderReturn.id);
  const refund = useRefundReturn(orderReturn.id);

  const suggestedRefund = orderReturn.items.reduce((sum, item) => sum + item.line_total, 0);

  const openReceiveDialog = () => {
    setRestockByItem(Object.fromEntries(orderReturn.items.map((item) => [item.id, item.restock])));
    setReceiveOpen(true);
  };

  const openRefundDialog = () => {
    setRefundAmount(suggestedRefund.toFixed(2));
    setRefundOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            {orderReturn.return_number}
            <Badge variant={STATUS_VARIANTS[orderReturn.status]}>{STATUS_LABELS[orderReturn.status]}</Badge>
          </CardTitle>
        </div>
        {canUpdate ? (
          <div className="flex flex-wrap gap-2">
            {orderReturn.status === "requested" ? (
              <Button size="sm" onClick={() => approve.mutate(undefined)} loading={approve.isPending}>
                <CheckCircle2 />
                Approve
              </Button>
            ) : null}
            {(orderReturn.status === "requested" || orderReturn.status === "approved") ? (
              <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
                <Ban />
                Reject
              </Button>
            ) : null}
            {orderReturn.status === "approved" ? (
              <Button size="sm" onClick={openReceiveDialog}>
                <PackageCheck />
                Receive
              </Button>
            ) : null}
            {orderReturn.status === "received" ? (
              <Button size="sm" onClick={openRefundDialog}>
                <RotateCcw />
                Refund
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-text-muted">Reason</p>
            <p className="font-medium text-text-primary">{orderReturn.reason ?? "—"}</p>
          </div>
          {orderReturn.refund_amount !== null ? (
            <div>
              <p className="text-text-muted">Refund amount</p>
              <p className="font-medium text-text-primary">{formatMoney(orderReturn.refund_amount, currencyCode)}</p>
            </div>
          ) : null}
          {orderReturn.refund_amount !== null ? (
            <div>
              <p className="text-text-muted">Refund method</p>
              <p className="font-medium text-text-primary">{REFUND_METHOD_LABELS[orderReturn.refund_method]}</p>
            </div>
          ) : null}
          {orderReturn.replacement_order ? (
            <div>
              <p className="text-text-muted">Replacement order</p>
              <Link
                href={`/dashboard/orders/orders/${orderReturn.replacement_order.id}`}
                className="font-medium text-primary hover:underline"
              >
                {orderReturn.replacement_order.order_number}
              </Link>
            </div>
          ) : null}
        </div>
        {orderReturn.note ? (
          <div>
            <p className="text-text-muted">Note</p>
            <p className="text-text-primary">{orderReturn.note}</p>
          </div>
        ) : null}
      </CardContent>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject return</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-note">Reason (optional)</Label>
            <Textarea id="reject-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={reject.isPending}
              onClick={() => reject.mutate({ note: note || undefined }, { onSuccess: () => setRejectOpen(false) })}
            >
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive return</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              {orderReturn.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`restock-${item.id}`}
                    checked={restockByItem[item.id] ?? item.restock}
                    onCheckedChange={(checked) =>
                      setRestockByItem((prev) => ({ ...prev, [item.id]: checked === true }))
                    }
                  />
                  <Label htmlFor={`restock-${item.id}`} className="flex-1 cursor-pointer font-normal">
                    Restock {item.quantity}x {item.product_name}
                    <span className="ml-1 text-xs text-text-muted">({item.product_variant_sku ?? item.sku})</span>
                    {item.exchange_product_id ? (
                      <span className="ml-1 text-xs text-info">
                        → will ship {item.exchange_product_name}
                        {item.exchange_product_variant_sku ? ` (${item.exchange_product_variant_sku})` : ""} as a replacement
                      </span>
                    ) : null}
                  </Label>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receive-note">Note (optional)</Label>
              <Textarea id="receive-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={receive.isPending}
              onClick={() =>
                receive.mutate(
                  {
                    items: orderReturn.items.map((item) => ({
                      return_item_id: item.id,
                      restock: restockByItem[item.id] ?? item.restock,
                    })),
                    note: note || undefined,
                  },
                  { onSuccess: () => setReceiveOpen(false) },
                )
              }
            >
              Confirm received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund return</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">Refund amount</Label>
            <Input
              id="refund-amount"
              inputMode="decimal"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-method">Refund method</Label>
            <Select value={refundMethod} onValueChange={(v) => setRefundMethod(v as RefundMethod)}>
              <SelectTrigger id="refund-method">
                <SelectValue>{REFUND_METHOD_LABELS[refundMethod]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REFUND_METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={refund.isPending}
              onClick={() =>
                refund.mutate(
                  { refund_amount: refundAmount || undefined, refund_method: refundMethod },
                  { onSuccess: () => setRefundOpen(false) },
                )
              }
            >
              Confirm refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
