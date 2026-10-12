"use client";

import { useState } from "react";
import { ArrowDown, Funnel } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAnalyticsFunnel } from "@/hooks/use-analytics";
import { PermissionDenied } from "@/components/permission-denied";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsFunnelStageName } from "@/types/analytics";

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toDateInput(from), to: toDateInput(to) };
}

const STAGE_LABELS: Record<AnalyticsFunnelStageName, string> = {
  product_view: "Product Views",
  add_to_cart: "Added to Cart",
  checkout_start: "Started Checkout",
  purchase: "Purchased",
};

export default function AnalyticsFunnelPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;

  const [dateRange, setDateRange] = useState(defaultDateRange);

  const filters = { dateFrom: dateRange.from, dateTo: dateRange.to };
  const { data: funnel, isLoading } = useAnalyticsFunnel(storeId, filters);

  if (currentUser && !can(currentUser, "analytics.view")) {
    return <PermissionDenied />;
  }

  const stages = funnel?.stages ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          aria-label="From date"
          value={dateRange.from}
          max={dateRange.to}
          onChange={(event) => setDateRange((prev) => ({ ...prev, from: event.target.value }))}
          className="w-40"
        />
        <span className="text-sm text-text-muted">to</span>
        <Input
          type="date"
          aria-label="To date"
          value={dateRange.to}
          min={dateRange.from}
          onChange={(event) => setDateRange((prev) => ({ ...prev, to: event.target.value }))}
          className="w-40"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : stages.length === 0 ? (
        <EmptyState
          icon={<Funnel />}
          title="No funnel data in range"
          description="Try a different date range."
        />
      ) : (
        <div className="flex flex-col">
          {stages.map((stage, index) => (
            <div key={stage.stage}>
              <Card>
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="space-y-1">
                    <p className="text-sm text-text-secondary">{STAGE_LABELS[stage.stage]}</p>
                    <p className="text-2xl font-semibold text-text-primary">{stage.sessions}</p>
                  </div>
                  {stage.conversion_from_previous !== null ? (
                    <div className="space-y-1 text-right">
                      <p className="text-xs text-text-muted">vs previous stage</p>
                      <p className="text-lg font-semibold text-text-primary">
                        {stage.conversion_from_previous.toFixed(1)}%
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              {index < stages.length - 1 ? (
                <div className="flex justify-center py-1 text-text-muted">
                  <ArrowDown className="size-4" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
