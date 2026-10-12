"use client";

import { use } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCodSettlement } from "@/hooks/use-cod-settlements";
import { formatMoney } from "@/lib/money";
import { PermissionDenied } from "@/components/permission-denied";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CodSettlementShowPage({ params }: PageProps<"/dashboard/delivery/cod-settlements/[id]">) {
  const { id } = use(params);
  const settlementId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const { data: settlement, isLoading, isError } = useCodSettlement(settlementId);

  if (currentUser && !can(currentUser, "cod_settlements.view")) {
    return <PermissionDenied />;
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (isError || !settlement) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this settlement. It may not exist.</AlertDescription>
      </Alert>
    );
  }

  const discrepancy = settlement.amount_received - settlement.amount_expected;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/delivery/cod-settlements">
          <ArrowLeft />
          Back to COD settlements
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{settlement.settlement_number}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-text-muted">Courier</p>
              <p className="font-medium text-text-primary">{settlement.courier.name}</p>
            </div>
            <div>
              <p className="text-text-muted">Expected</p>
              <p className="font-medium text-text-primary">{formatMoney(settlement.amount_expected, "BDT")}</p>
            </div>
            <div>
              <p className="text-text-muted">Received</p>
              <p className="font-medium text-text-primary">{formatMoney(settlement.amount_received, "BDT")}</p>
            </div>
            <div>
              <p className="text-text-muted">Discrepancy</p>
              <p className={`font-medium ${discrepancy === 0 ? "text-text-primary" : "text-danger"}`}>
                {discrepancy === 0 ? "None" : formatMoney(discrepancy, "BDT")}
              </p>
            </div>
          </div>

          {settlement.note ? (
            <div className="text-sm">
              <p className="text-text-muted">Note</p>
              <p className="text-text-primary">{settlement.note}</p>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm text-text-muted">Shipments covered</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-table">
                <thead className="border-b border-border">
                  <tr>
                    <th className="px-4 py-2 font-medium text-text-secondary">Order</th>
                    <th className="px-4 py-2 font-medium text-text-secondary">Tracking #</th>
                    <th className="px-4 py-2 font-medium text-text-secondary">COD collected</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.shipments.map((shipment) => (
                    <tr key={shipment.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-text-primary">{shipment.order_number}</td>
                      <td className="px-4 py-2 text-text-primary">{shipment.tracking_number}</td>
                      <td className="px-4 py-2 text-text-primary">{formatMoney(shipment.cod_amount_collected, "BDT")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-text-muted">
            Recorded by {settlement.created_by ?? "—"} on {new Date(settlement.created_at).toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
