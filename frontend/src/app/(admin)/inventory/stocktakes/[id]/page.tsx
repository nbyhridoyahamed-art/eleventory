"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useStockAdjustmentSession } from "@/hooks/use-inventory";
import { variantLabel } from "@/lib/variant";
import { PermissionDenied } from "@/components/permission-denied";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function StockAdjustmentSessionShowPage({ params }: PageProps<"/inventory/stocktakes/[id]">) {
  const { id } = use(params);
  const sessionId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const { data: session, isLoading, isError } = useStockAdjustmentSession(sessionId);

  if (currentUser && !can(currentUser, "inventory.view")) {
    return <PermissionDenied />;
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !session) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this stocktake. It may not exist.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/inventory/stocktakes">
          <ArrowLeft />
          Back to stocktakes
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{session.reference}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-text-muted">Warehouse</p>
              <p className="font-medium text-text-primary">{session.warehouse.name}</p>
            </div>
            <div>
              <p className="text-text-muted">Recorded by</p>
              <p className="font-medium text-text-primary">{session.created_by ?? "—"}</p>
            </div>
            <div>
              <p className="text-text-muted">Date</p>
              <p className="font-medium text-text-primary">{new Date(session.created_at).toLocaleString()}</p>
            </div>
          </div>

          {session.note ? (
            <div className="text-sm">
              <p className="text-text-muted">Note</p>
              <p className="text-text-primary">{session.note}</p>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm text-text-muted">Lines</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-table">
                <thead className="border-b border-border">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text-secondary">Product</th>
                    <th className="px-4 py-2 font-medium text-text-secondary">Direction</th>
                    <th className="px-4 py-2 font-medium text-text-secondary">Quantity</th>
                    <th className="px-4 py-2 font-medium text-text-secondary">Before → After</th>
                    <th className="px-4 py-2 font-medium text-text-secondary">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {session.movements.map((movement) => (
                    <tr key={movement.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-text-primary">
                        {movement.product.name}
                        {variantLabel(movement.product_variant) ? (
                          <span className="ml-1 text-xs text-text-muted">{variantLabel(movement.product_variant)}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={movement.type === "adjustment_increase" ? "success" : "warning"}>
                          {movement.type === "adjustment_increase" ? "Increase" : "Decrease"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-text-primary">{movement.quantity}</td>
                      <td className="px-4 py-2 text-text-primary">
                        {movement.quantity_before} → {movement.quantity_after}
                      </td>
                      <td className="px-4 py-2 text-text-secondary">{movement.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
