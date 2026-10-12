"use client";

import { use, useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, PackageCheck, Pencil, Truck, Wallet } from "lucide-react";
import Link from "next/link";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAllCustomers } from "@/hooks/use-customers";
import {
  useCancelOrder,
  useDeliverOrder,
  useOrder,
  useProcessOrder,
  useRecordOrderPayment,
  useShipOrder,
  useUpdateOrder,
} from "@/hooks/use-orders";
import { useAllProducts } from "@/hooks/use-products";
import { useCreateReturn } from "@/hooks/use-returns";
import { useCreateShipment, useShipment } from "@/hooks/use-shipments";
import { useAllWarehouses } from "@/hooks/use-warehouses";
import { formatMoney } from "@/lib/money";
import { variantLabel } from "@/lib/variant";
import { OrderForm } from "@/components/orders/order-form";
import { PermissionDenied } from "@/components/permission-denied";
import { ShipmentAssignForm } from "@/components/delivery/shipment-assign-form";
import { ShipmentStatusCard } from "@/components/delivery/shipment-status-card";
import { ReturnRequestForm } from "@/components/returns/return-request-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/types/api";
import type { Order, OrderStatus, PaymentMethod } from "@/types/order";
import type { ReturnStatus } from "@/types/return";

type BadgeVariant = BadgeProps["variant"];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on delivery",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  card: "Card",
  bank_transfer: "Bank transfer",
};

const PAYMENT_STATUS_LABELS: Record<Order["payment_status"], string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

const PAYMENT_STATUS_VARIANTS: Record<Order["payment_status"], BadgeVariant> = {
  unpaid: "neutral",
  partially_paid: "warning",
  paid: "success",
  partially_refunded: "warning",
  refunded: "info",
};

function orderToFormDefaults(order: Order) {
  const usingSavedAddress = order.shipping.customer_address_id !== null;

  return {
    customer_id: String(order.customer.id),
    warehouse_id: String(order.warehouse.id),
    payment_method: order.payment_method,
    customer_address_id: usingSavedAddress ? String(order.shipping.customer_address_id) : "manual",
    shipping_recipient_name: order.shipping.recipient_name,
    shipping_phone: order.shipping.phone,
    shipping_address_line: order.shipping.address_line,
    shipping_bd_division_id: order.shipping.bd_division_id ? String(order.shipping.bd_division_id) : "",
    shipping_bd_district_id: order.shipping.bd_district_id ? String(order.shipping.bd_district_id) : "",
    shipping_bd_upazila_id: order.shipping.bd_upazila_id ? String(order.shipping.bd_upazila_id) : "",
    shipping_amount: order.shipping_amount ? String(order.shipping_amount) : "",
    discount_amount: order.coupon_code || !order.discount_amount ? "" : String(order.discount_amount),
    coupon_code: order.coupon_code ?? "",
    store_credit_amount: order.store_credit_amount ? String(order.store_credit_amount) : "",
    notes: order.notes ?? "",
    items: order.items.map((item) => ({
      product_id: String(item.product_id),
      product_variant_id: item.product_variant ? String(item.product_variant.id) : "",
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
    })),
  };
}

function RecordPaymentDialog({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bkash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const recordPayment = useRecordOrderPayment(orderId);

  const reset = () => {
    setAmount("");
    setMethod("bkash");
    setReference("");
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>Reconciles a non-COD payment against this order&apos;s total.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {recordPayment.error instanceof ApiError ? (
            <Alert variant="danger">
              <AlertDescription>{recordPayment.error.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="order-payment-amount">Amount</Label>
              <Input
                id="order-payment-amount"
                type="number"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-payment-method">Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger id="order-payment-method">
                  <SelectValue>{PAYMENT_METHOD_LABELS[method]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order-payment-reference">Reference (optional)</Label>
            <Input
              id="order-payment-reference"
              placeholder="e.g. transaction ID"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order-payment-note">Note (optional)</Label>
            <Textarea id="order-payment-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={recordPayment.isPending}
            disabled={!amount || Number(amount) <= 0}
            onClick={() =>
              recordPayment.mutate(
                { amount, method, reference: reference || null, note: note || null },
                { onSuccess: () => { onOpenChange(false); reset(); } },
              )
            }
          >
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<OrderStatus, BadgeVariant> = {
  pending: "neutral",
  processing: "info",
  shipped: "warning",
  delivered: "success",
  cancelled: "danger",
};

const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  received: "Received",
  refunded: "Refunded",
};

const RETURN_STATUS_VARIANTS: Record<ReturnStatus, BadgeVariant> = {
  requested: "neutral",
  approved: "info",
  rejected: "danger",
  received: "warning",
  refunded: "success",
};

export default function OrderShowPage({ params }: PageProps<"/dashboard/orders/orders/[id]">) {
  const { id } = use(params);
  const orderId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const { data: order, isLoading, isError } = useOrder(orderId);
  const processOrder = useProcessOrder(orderId);
  const shipOrder = useShipOrder(orderId);
  const deliverOrder = useDeliverOrder(orderId);
  const cancelOrder = useCancelOrder(orderId);
  const updateOrder = useUpdateOrder(orderId);
  const createShipment = useCreateShipment(orderId);
  const latestShipmentSummary = order?.shipments[order.shipments.length - 1];
  const { data: shipment } = useShipment(latestShipmentSummary?.id);
  const canReDispatch = latestShipmentSummary
    ? latestShipmentSummary.status === "failed_delivery" || latestShipmentSummary.status === "returned_to_seller"
    : true;
  const createReturn = useCreateReturn(orderId);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  const storeId = currentUser?.current_store_id;
  const { data: customersData } = useAllCustomers(isEditing ? storeId : null);
  const { data: warehousesData } = useAllWarehouses(isEditing ? storeId : null);
  // Also needed for the return-request form's "exchange for" picker, which
  // is offered whenever a return can be requested — not only while editing.
  const { data: productsData } = useAllProducts(isEditing || order?.status === "delivered" ? storeId : null);

  if (currentUser && !can(currentUser, "orders.view")) {
    return <PermissionDenied />;
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (isError || !order) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this order. It may not exist.</AlertDescription>
      </Alert>
    );
  }

  const canUpdate = can(currentUser, "orders.update");
  const canCancel = can(currentUser, "orders.cancel");
  const canRecordPayment = can(currentUser, "orders.record_payment");

  const shippingLine = [order.shipping.address_line, order.shipping.upazila, order.shipping.district, order.shipping.division]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/orders/orders">
          <ArrowLeft />
          Back to orders
        </Link>
      </Button>

      {order.source_return ? (
        <Alert>
          <AlertDescription>
            This order is a replacement created from{" "}
            <Link href={`/dashboard/orders/returns/${order.source_return.id}`} className="font-medium text-primary hover:underline">
              return {order.source_return.return_number}
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              {order.order_number}
              <Badge variant={STATUS_VARIANTS[order.status]}>{STATUS_LABELS[order.status]}</Badge>
              <Badge variant={PAYMENT_STATUS_VARIANTS[order.payment_status]}>
                {PAYMENT_STATUS_LABELS[order.payment_status]}
              </Badge>
              <Badge variant={order.source === "storefront" ? "info" : "neutral"}>
                {order.source === "storefront" ? "Storefront" : "Admin"}
              </Badge>
            </CardTitle>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel edit
              </Button>
            ) : (
              <>
                {order.status === "pending" && canUpdate ? (
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                    <Pencil />
                    Edit order
                  </Button>
                ) : null}
                {order.status === "pending" && canUpdate ? (
                  <Button size="sm" onClick={() => processOrder.mutate()} loading={processOrder.isPending}>
                    <PackageCheck />
                    Move to processing
                  </Button>
                ) : null}
                {(order.status === "pending" || order.status === "processing") && canUpdate ? (
                  <Button size="sm" onClick={() => shipOrder.mutate()} loading={shipOrder.isPending}>
                    <Truck />
                    Ship
                  </Button>
                ) : null}
                {order.status === "shipped" && order.shipments.length === 0 && canUpdate ? (
                  <Button size="sm" onClick={() => deliverOrder.mutate()} loading={deliverOrder.isPending}>
                    <CheckCircle2 />
                    Mark delivered
                  </Button>
                ) : null}
                {(order.status === "pending" || order.status === "processing") && canCancel ? (
                  <Button size="sm" variant="outline" onClick={() => setConfirmCancel(true)}>
                    <Ban />
                    Cancel
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            storeId && customersData && warehousesData && productsData ? (
              <OrderForm
                storeId={storeId}
                customers={customersData.data}
                warehouses={warehousesData.data}
                products={productsData.data}
                isPending={updateOrder.isPending}
                submitLabel="Save changes"
                serverError={updateOrder.error instanceof ApiError ? updateOrder.error.message : null}
                defaultValues={orderToFormDefaults(order)}
                onSubmit={(values) =>
                  updateOrder.mutate(values, { onSuccess: () => setIsEditing(false) })
                }
              />
            ) : (
              <Skeleton className="h-64 w-full" />
            )
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-text-muted">Customer</p>
                  <p className="font-medium text-text-primary">{order.customer.name}</p>
                </div>
                <div>
                  <p className="text-text-muted">Warehouse</p>
                  <p className="font-medium text-text-primary">{order.warehouse.name}</p>
                </div>
                <div>
                  <p className="text-text-muted">Payment method</p>
                  <p className="font-medium text-text-primary">{order.payment_method}</p>
                </div>
                <div>
                  <p className="text-text-muted">Date</p>
                  <p className="font-medium text-text-primary">{new Date(order.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="text-sm">
                <p className="text-text-muted">Shipping to</p>
                <p className="font-medium text-text-primary">{order.shipping.recipient_name}</p>
                <p className="text-text-primary">{order.shipping.phone}</p>
                <p className="text-text-primary">{shippingLine}</p>
              </div>

              {order.notes ? (
                <div className="text-sm">
                  <p className="text-text-muted">Notes</p>
                  <p className="text-text-primary">{order.notes}</p>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-sm text-text-muted">Items</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-table">
                    <thead className="border-b border-border">
                      <tr>
                        <th className="px-4 py-2 font-medium text-text-secondary">Product</th>
                        <th className="px-4 py-2 font-medium text-text-secondary">Qty</th>
                        <th className="px-4 py-2 font-medium text-text-secondary">Unit price</th>
                        <th className="px-4 py-2 font-medium text-text-secondary">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item) => (
                        <tr key={item.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2 text-text-primary">
                            {item.product_name}
                            <span className="ml-1 text-xs text-text-muted">
                              ({item.sku}){variantLabel(item.product_variant) ? ` — ${variantLabel(item.product_variant)}` : ""}
                            </span>
                            {item.components ? (
                              <ul className="mt-1 space-y-0.5 border-l border-border pl-2 text-xs text-text-muted">
                                {item.components.map((component, index) => (
                                  <li key={index}>
                                    {component.quantity}× {component.product_name} ({component.sku}
                                    {component.product_variant_sku ? ` — ${component.product_variant_sku}` : ""})
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 text-text-primary">{item.quantity}</td>
                          <td className="px-4 py-2 text-text-primary">{formatMoney(item.unit_price, order.currency_code)}</td>
                          <td className="px-4 py-2 text-text-primary">{formatMoney(item.line_total, order.currency_code)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 space-y-1 text-right text-sm">
                  <p className="text-text-secondary">Subtotal: {formatMoney(order.subtotal_amount, order.currency_code)}</p>
                  {order.shipping_amount > 0 ? (
                    <p className="text-text-secondary">Shipping: {formatMoney(order.shipping_amount, order.currency_code)}</p>
                  ) : null}
                  {order.discount_amount > 0 ? (
                    <p className="text-text-secondary">
                      Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}: -
                      {formatMoney(order.discount_amount, order.currency_code)}
                    </p>
                  ) : null}
                  {order.store_credit_amount > 0 ? (
                    <p className="text-text-secondary">
                      Store credit: -{formatMoney(order.store_credit_amount, order.currency_code)}
                    </p>
                  ) : null}
                  <p className="font-medium text-text-primary">
                    Total: {formatMoney(order.total_amount, order.currency_code)}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {order.status === "shipped" && canReDispatch && can(currentUser, "shipments.create") ? (
        <Card>
          <CardHeader>
            <CardTitle>{order.shipments.length === 0 ? "Assign a courier" : "Re-dispatch with a new shipment"}</CardTitle>
          </CardHeader>
          <CardContent>
            <ShipmentAssignForm
              storeId={currentUser?.current_store_id ?? 0}
              isPending={createShipment.isPending}
              serverError={createShipment.error instanceof ApiError ? createShipment.error.message : null}
              onSubmit={(values) => createShipment.mutate(values)}
            />
          </CardContent>
        </Card>
      ) : null}

      {order.shipments.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Shipment history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {order.shipments.slice(0, -1).map((entry) => (
                <li key={entry.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                  <Link href={`/dashboard/delivery/shipments/${entry.id}`} className="font-medium text-primary hover:underline">
                    {entry.tracking_number}
                  </Link>
                  <div className="flex items-center gap-3 text-text-muted">
                    {entry.courier_name ? <span>{entry.courier_name}</span> : null}
                    <Badge variant={entry.status === "returned_to_seller" ? "danger" : "warning"}>
                      {entry.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {shipment ? <ShipmentStatusCard shipment={shipment} canUpdate={can(currentUser, "shipments.update")} /> : null}

      {order.returns.length > 0 && can(currentUser, "returns.view") ? (
        <Card>
          <CardHeader>
            <CardTitle>Returns</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {order.returns.map((orderReturn) => (
                <li key={orderReturn.id} className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/orders/returns/${orderReturn.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {orderReturn.return_number}
                  </Link>
                  <div className="flex items-center gap-3">
                    {orderReturn.refund_amount !== null ? (
                      <span className="text-text-secondary">{formatMoney(orderReturn.refund_amount, order.currency_code)}</span>
                    ) : null}
                    <Badge variant={RETURN_STATUS_VARIANTS[orderReturn.status as ReturnStatus]}>
                      {RETURN_STATUS_LABELS[orderReturn.status as ReturnStatus]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {order.status === "delivered" && can(currentUser, "returns.create") ? (
        <Card>
          <CardHeader>
            <CardTitle>Request a return</CardTitle>
          </CardHeader>
          <CardContent>
            <ReturnRequestForm
              items={order.items}
              products={productsData?.data ?? []}
              isPending={createReturn.isPending}
              serverError={createReturn.error instanceof ApiError ? createReturn.error.message : null}
              onSubmit={(values) => createReturn.mutate(values)}
            />
          </CardContent>
        </Card>
      ) : null}

      {order.status !== "cancelled" && order.payment_status !== "refunded" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Payments</CardTitle>
            {canRecordPayment ? (
              <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
                <Wallet />
                Record payment
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {order.payments.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="font-medium text-text-primary">
                        {formatMoney(payment.amount, payment.currency_code)} — {PAYMENT_METHOD_LABELS[payment.method]}
                      </p>
                      {payment.reference ? <p className="text-xs text-text-muted">Ref: {payment.reference}</p> : null}
                    </div>
                    <div className="text-right text-text-muted">
                      <p>{new Date(payment.created_at).toLocaleString()}</p>
                      {payment.created_by ? <p>{payment.created_by}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No payments recorded yet.</p>
            )}
            <p className="text-right text-sm font-medium text-text-primary">
              Paid: {formatMoney(order.payments.reduce((sum, p) => sum + p.amount, 0), order.currency_code)} / Total:{" "}
              {formatMoney(order.total_amount, order.currency_code)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Status history</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {order.status_history.map((entry, index) => (
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

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel order</DialogTitle>
            <DialogDescription>
              This will cancel {order.order_number} and release its reserved stock. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Keep order
            </Button>
            <Button
              variant="destructive"
              loading={cancelOrder.isPending}
              onClick={() => cancelOrder.mutate(undefined, { onSuccess: () => setConfirmCancel(false) })}
            >
              Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecordPaymentDialog orderId={orderId} open={paymentOpen} onOpenChange={setPaymentOpen} />
    </div>
  );
}
