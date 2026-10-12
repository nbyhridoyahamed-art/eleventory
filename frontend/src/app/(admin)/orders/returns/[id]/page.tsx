"use client";

import { use } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useReturn } from "@/hooks/use-returns";
import { formatMoney } from "@/lib/money";
import { PermissionDenied } from "@/components/permission-denied";
import { ReturnStatusCard } from "@/components/returns/return-status-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReturnStatus } from "@/types/return";

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

export default function ReturnShowPage({ params }: PageProps<"/orders/returns/[id]">) {
  const { id } = use(params);
  const returnId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const { data: orderReturn, isLoading, isError } = useReturn(returnId);

  if (currentUser && !can(currentUser, "returns.view")) {
    return <PermissionDenied />;
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (isError || !orderReturn) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this return. It may not exist.</AlertDescription>
      </Alert>
    );
  }

  const canUpdate = can(currentUser, "returns.update");

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/orders/returns">
          <ArrowLeft />
          Back to returns
        </Link>
      </Button>

      <ReturnStatusCard orderReturn={orderReturn} currencyCode="BDT" canUpdate={canUpdate} />

      <Card>
        <CardHeader>
          <CardTitle>Order</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-text-muted">Order</p>
            <Link
              href={`/orders/orders/${orderReturn.order.id}`}
              className="font-medium text-primary hover:underline"
            >
              {orderReturn.order.order_number}
            </Link>
          </div>
          <div>
            <p className="text-text-muted">Customer</p>
            <p className="font-medium text-text-primary">{orderReturn.order.customer_name ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-table">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-4 py-2 font-medium text-text-secondary">Product</th>
                  <th className="px-4 py-2 font-medium text-text-secondary">Qty</th>
                  <th className="px-4 py-2 font-medium text-text-secondary">Unit price</th>
                  <th className="px-4 py-2 font-medium text-text-secondary">Line total</th>
                  <th className="px-4 py-2 font-medium text-text-secondary">Restock</th>
                  <th className="px-4 py-2 font-medium text-text-secondary">Exchange for</th>
                </tr>
              </thead>
              <tbody>
                {orderReturn.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-text-primary">
                      {item.product_name}
                      <span className="ml-1 text-xs text-text-muted">({item.product_variant_sku ?? item.sku})</span>
                    </td>
                    <td className="px-4 py-2 text-text-primary">{item.quantity}</td>
                    <td className="px-4 py-2 text-text-primary">{formatMoney(item.unit_price, "BDT")}</td>
                    <td className="px-4 py-2 text-text-primary">{formatMoney(item.line_total, "BDT")}</td>
                    <td className="px-4 py-2 text-text-primary">{item.restock ? "Yes" : "No"}</td>
                    <td className="px-4 py-2 text-text-primary">
                      {item.exchange_product_id ? (
                        <>
                          {item.exchange_product_name}
                          {item.exchange_product_variant_sku ? (
                            <span className="ml-1 text-xs text-text-muted">({item.exchange_product_variant_sku})</span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status history</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {orderReturn.status_history.map((entry, index) => (
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
