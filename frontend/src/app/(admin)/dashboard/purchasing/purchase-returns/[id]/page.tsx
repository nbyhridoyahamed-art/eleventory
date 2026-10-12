"use client";

import { use } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { usePurchaseReturn } from "@/hooks/use-purchase-returns";
import { formatMoney } from "@/lib/money";
import { PermissionDenied } from "@/components/permission-denied";
import { PurchaseReturnStatusCard } from "@/components/purchasing/purchase-return-status-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PurchaseReturnStatus } from "@/types/purchase-return";

type BadgeVariant = BadgeProps["variant"];

const STATUS_LABELS: Record<PurchaseReturnStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  shipped_back: "Shipped back",
  credited: "Credited",
};

const STATUS_VARIANTS: Record<PurchaseReturnStatus, BadgeVariant> = {
  requested: "neutral",
  approved: "info",
  rejected: "danger",
  shipped_back: "warning",
  credited: "success",
};

export default function PurchaseReturnShowPage({ params }: PageProps<"/dashboard/purchasing/purchase-returns/[id]">) {
  const { id } = use(params);
  const returnId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const { data: purchaseReturn, isLoading, isError } = usePurchaseReturn(returnId);

  if (currentUser && !can(currentUser, "purchase_returns.view")) {
    return <PermissionDenied />;
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (isError || !purchaseReturn) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this purchase return. It may not exist.</AlertDescription>
      </Alert>
    );
  }

  const canUpdate = can(currentUser, "purchase_returns.update");

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/purchasing/purchase-returns">
          <ArrowLeft />
          Back to purchase returns
        </Link>
      </Button>

      <PurchaseReturnStatusCard purchaseReturn={purchaseReturn} currencyCode="BDT" canUpdate={canUpdate} />

      <Card>
        <CardHeader>
          <CardTitle>Purchase order</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-text-muted">Purchase order</p>
            <Link
              href={`/dashboard/purchasing/purchase-orders/${purchaseReturn.purchase_order.id}`}
              className="font-medium text-primary hover:underline"
            >
              {purchaseReturn.purchase_order.po_number}
            </Link>
          </div>
          <div>
            <p className="text-text-muted">Supplier</p>
            <p className="font-medium text-text-primary">{purchaseReturn.purchase_order.supplier_name ?? "—"}</p>
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
                  <th className="px-4 py-2 font-medium text-text-secondary">Unit cost</th>
                  <th className="px-4 py-2 font-medium text-text-secondary">Line total</th>
                </tr>
              </thead>
              <tbody>
                {purchaseReturn.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-text-primary">
                      {item.product_name}
                      <span className="ml-1 text-xs text-text-muted">({item.product_variant_sku ?? item.sku})</span>
                    </td>
                    <td className="px-4 py-2 text-text-primary">{item.quantity}</td>
                    <td className="px-4 py-2 text-text-primary">{formatMoney(item.unit_cost, "BDT")}</td>
                    <td className="px-4 py-2 text-text-primary">{formatMoney(item.line_total, "BDT")}</td>
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
            {purchaseReturn.status_history.map((entry, index) => (
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
