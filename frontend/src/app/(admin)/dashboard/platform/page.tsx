"use client";

import Link from "next/link";

import { usePlatformOverview } from "@/hooks/use-platform";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "danger" }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs text-text-secondary">{label}</div>
        <div className={`mt-1 text-3xl font-bold ${tone === "danger" ? "text-danger" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

export default function PlatformOverviewPage() {
  const { data, isLoading } = usePlatformOverview();

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

  const { tenants, subscriptions, revenue } = data;
  const money = (n: number) => `${revenue.currency === "BDT" ? "৳" : revenue.currency + " "}${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Shops" value={tenants.total} />
        <Stat label="New in 30 days" value={tenants.new_30d} />
        <Stat label="On trial" value={subscriptions.trialing} />
        <Stat label="Paying" value={subscriptions.paying} />
        <Stat label="MRR" value={money(revenue.mrr)} />
        <Stat label="Collected (30 days)" value={money(revenue.collected_30d)} />
        <Stat label="Churn (30 days)" value={`${revenue.churn_30d_percent}%`} />
        <Stat label="Trials ending in 7 days" value={subscriptions.trials_ending_7d} />
        <Stat label="Payment overdue" value={subscriptions.past_due} tone={subscriptions.past_due ? "danger" : undefined} />
        <Stat label="Suspended shops" value={tenants.suspended} tone={tenants.suspended ? "danger" : undefined} />
        <Stat label="Cancelled (30 days)" value={subscriptions.cancelled_30d} />
        <Stat label="Open abuse reports" value={data.open_reports} tone={data.open_reports ? "danger" : undefined} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paying accounts by plan</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {Object.keys(data.by_plan).length === 0 ? (
            <p className="text-text-secondary">No active subscriptions yet.</p>
          ) : (
            <ul className="space-y-1">
              {Object.entries(data.by_plan).map(([plan, count]) => (
                <li key={plan} className="flex justify-between">
                  <span>{plan}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-text-secondary">
            <Link href="/dashboard/platform/tenants" className="text-primary underline">Open the tenant directory</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
