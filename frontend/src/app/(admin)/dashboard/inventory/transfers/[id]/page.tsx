"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useStockTransfer } from "@/hooks/use-inventory";
import { variantLabel } from "@/lib/variant";
import { PermissionDenied } from "@/components/permission-denied";
import { StockTransferStatusCard } from "@/components/inventory/stock-transfer-status-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { StockTransferStatus } from "@/types/inventory";

type BadgeVariant = BadgeProps["variant"];

const STATUS_LABELS: Record<StockTransferStatus, string> = {
  pending: "Pending",
  in_transit: "In transit",
  received: "Received",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<StockTransferStatus, BadgeVariant> = {
  pending: "neutral",
  in_transit: "info",
  received: "success",
  cancelled: "danger",
};

export default function StockTransferShowPage({ params }: PageProps<"/dashboard/inventory/transfers/[id]">) {
  const { id } = use(params);
  const transferId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const { data: transfer, isLoading, isError } = useStockTransfer(transferId);

  if (currentUser && !can(currentUser, "inventory.transfer")) {
    return <PermissionDenied />;
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (isError || !transfer) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this transfer. It may not exist.</AlertDescription>
      </Alert>
    );
  }

  const canUpdate = can(currentUser, "inventory.transfer");

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/inventory/transfers">
          <ArrowLeft />
          Back to transfers
        </Link>
      </Button>

      <StockTransferStatusCard transfer={transfer} canUpdate={canUpdate} />

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
                  <th className="px-4 py-2 font-medium text-text-secondary">SKU</th>
                  <th className="px-4 py-2 font-medium text-text-secondary">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {transfer.items.map((item, i) => (
                  <tr key={`${item.product_id}-${item.product_variant?.id ?? i}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-text-primary">
                      {item.product_name}
                      {variantLabel(item.product_variant) ? (
                        <span className="ml-1 text-xs text-text-muted">{variantLabel(item.product_variant)}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-text-primary">{item.product_variant?.sku ?? item.sku}</td>
                    <td className="px-4 py-2 text-text-primary">{item.quantity}</td>
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
            {transfer.status_history.map((entry, index) => (
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

      {transfer.movements.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Stock movements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-table">
                <thead className="border-b border-border">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text-secondary">Warehouse</th>
                    <th className="px-4 py-2 font-medium text-text-secondary">Type</th>
                    <th className="px-4 py-2 font-medium text-text-secondary">Quantity</th>
                    <th className="px-4 py-2 font-medium text-text-secondary">Before → After</th>
                    <th className="px-4 py-2 font-medium text-text-secondary">When</th>
                  </tr>
                </thead>
                <tbody>
                  {transfer.movements.map((movement) => (
                    <tr key={movement.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-text-primary">{movement.warehouse.name}</td>
                      <td className="px-4 py-2 text-text-primary">
                        {movement.type === "transfer_out" ? "Transfer out" : "Transfer in"}
                      </td>
                      <td className="px-4 py-2 text-text-primary">{movement.quantity}</td>
                      <td className="px-4 py-2 text-text-primary">
                        {movement.quantity_before} → {movement.quantity_after}
                      </td>
                      <td className="px-4 py-2 text-text-muted">{new Date(movement.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
