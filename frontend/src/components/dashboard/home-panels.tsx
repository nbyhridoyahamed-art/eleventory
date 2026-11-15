"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts/sparkline";
import { Donut } from "@/components/charts/donut";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalyticsFunnel } from "@/hooks/use-analytics";

/** Fixed colour per payment method, so a filter never repaints the survivors. */
const PAYMENT_COLORS: Record<string, string> = {
  cod: "#1baf7a",
  bkash: "#e87ba4",
  nagad: "#eb6834",
  rocket: "#F7B538",
  card: "#2a78d6",
  bank_transfer: "#64748b",
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on delivery",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  card: "Card",
  bank_transfer: "Bank transfer",
};

export function ChangeBadge({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-xs text-text-muted">no earlier data</span>;
  if (percent === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-text-muted">
        <Minus className="size-3" /> 0%
      </span>
    );
  }
  const up = percent > 0;

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", up ? "text-success" : "text-danger")}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {Math.abs(percent)}%
    </span>
  );
}

export function KpiTile({
  label,
  value,
  percent,
  series,
  footnote,
}: {
  label: string;
  value: string;
  percent: number | null;
  series: number[];
  footnote: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="font-display text-3xl font-semibold tracking-tight text-text-primary">{value}</p>
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <ChangeBadge percent={percent} /> {footnote}
        </p>
        <Sparkline values={series} className="w-full" label={`${label} trend`} />
      </CardContent>
    </Card>
  );
}

export function PaymentMix({ methods }: { methods: { method: string; orders: number }[] }) {
  const slices = methods.map((m) => ({
    key: m.method,
    label: PAYMENT_LABELS[m.method] ?? m.method,
    value: m.orders,
    color: PAYMENT_COLORS[m.method] ?? "#64748b",
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>How customers pay</CardTitle>
        <p className="text-xs text-text-muted">Orders by payment method</p>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">No sales in this period yet.</p>
        ) : (
          <Donut slices={slices} totalLabel="orders" />
        )}
      </CardContent>
    </Card>
  );
}

const FUNNEL_LABELS: Record<string, string> = {
  product_view: "Viewed a product",
  add_to_cart: "Added to cart",
  checkout_start: "Started checkout",
  purchase: "Bought",
};

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Visitor funnel from the storefront analytics events. Only shown to people who may view analytics. */
export function VisitorFunnel({ storeId, days }: { storeId: number | null | undefined; days: number }) {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  const { data, isLoading } = useAnalyticsFunnel(storeId, { dateFrom: isoDay(from), dateTo: isoDay(to) });
  const stages = data?.stages ?? [];
  const top = Math.max(...stages.map((s) => s.sessions), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitors who buy</CardTitle>
        <p className="text-xs text-text-muted">Where shoppers drop off, last {days} days</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : stages.every((s) => s.sessions === 0) ? (
          <p className="py-10 text-center text-sm text-text-muted">No storefront visits recorded in this period.</p>
        ) : (
          <ul className="space-y-3">
            {stages.map((stage, index) => (
              <li key={stage.stage}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="text-text-secondary">{FUNNEL_LABELS[stage.stage] ?? stage.stage}</span>
                  <span className="font-mono text-text-primary">
                    {stage.sessions.toLocaleString("en-US")}
                    {index > 0 && stage.conversion_from_previous !== null ? (
                      <span className="ml-2 text-xs text-text-muted">{stage.conversion_from_previous}%</span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-border">
                  <div
                    className={cn("h-full rounded-full", index === stages.length - 1 ? "bg-accent" : "bg-primary")}
                    style={{ width: `${Math.max((stage.sessions / top) * 100, stage.sessions > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
