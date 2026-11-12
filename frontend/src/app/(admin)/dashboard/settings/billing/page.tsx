"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useBilling,
  useCancelSubscription,
  usePayInvoice,
  useResumeSubscription,
  useSubscribe,
  type BillingInvoice,
  type BillingPlan,
  type BillingSubscription,
  type BillingUsage,
} from "@/hooks/use-billing";
import { PermissionDenied } from "@/components/permission-denied";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const USAGE_LABEL: Record<BillingUsage["resource"], string> = {
  products: "Products",
  staff: "Staff accounts",
  orders_per_month: "Orders this month",
  custom_domains: "Custom domains",
  storage_mb: "File storage (MB)",
};

const STATUS: Record<BillingSubscription["status"], { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  trialing: { label: "Free trial", variant: "warning" },
  active: { label: "Active", variant: "success" },
  past_due: { label: "Payment due", variant: "danger" },
  suspended: { label: "Suspended", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

const LIMIT_LABEL: Record<string, string> = {
  products: "products",
  staff: "staff accounts",
  orders_per_month: "orders a month",
  custom_domains: "custom domains",
  storage_mb: "MB of file storage",
};

function money(amount: number, currency: string) {
  return `${currency === "BDT" ? "৳" : `${currency} `}${amount.toLocaleString()}`;
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "";
}

function Meter({ used, limit }: { used: number; limit: number | null }) {
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className={percent >= 90 ? "h-full bg-danger" : "h-full bg-primary"} style={{ width: `${percent}%` }} />
    </div>
  );
}

function PlanCard({
  plan,
  cycle,
  current,
  busy,
  onChoose,
}: {
  plan: BillingPlan;
  cycle: "monthly" | "yearly";
  current: boolean;
  busy: boolean;
  onChoose: () => void;
}) {
  const price = cycle === "yearly" ? plan.price_yearly : plan.price_monthly;

  return (
    <Card className={current ? "border-2 border-primary" : undefined}>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center gap-2 font-semibold">
          {plan.name}
          {current ? <Badge variant="primary">Current</Badge> : null}
        </div>
        <div className="text-2xl font-bold">
          {money(price, plan.currency)}
          <span className="text-sm font-medium text-text-secondary"> /{cycle === "yearly" ? "yr" : "mo"}</span>
        </div>
        <ul className="space-y-1 text-sm text-text-secondary">
          {Object.entries(plan.limits).map(([key, value]) => (
            <li key={key}>
              {value === null ? "Unlimited" : value.toLocaleString()} {LIMIT_LABEL[key] ?? key}
            </li>
          ))}
          {plan.features.online_payments ? <li>Online payments</li> : null}
        </ul>
        <Button variant={current ? "outline" : "primary"} className="w-full" disabled={current || busy} onClick={onChoose}>
          {current ? "Your plan" : `Choose ${plan.name}`}
        </Button>
      </CardContent>
    </Card>
  );
}

function InvoiceRow({ invoice, onPay, busy }: { invoice: BillingInvoice; onPay: () => void; busy: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3 text-sm first:border-t-0">
      <div>
        <div className="font-medium">{invoice.number}</div>
        <div className="text-text-secondary">
          {invoice.description ?? ""} · {date(invoice.created_at)}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold">{money(invoice.amount, invoice.currency)}</span>
        <Badge variant={invoice.status === "paid" ? "success" : invoice.status === "open" ? "warning" : "neutral"}>{invoice.status}</Badge>
        {invoice.status === "open" ? (
          <Button size="sm" disabled={busy} onClick={onPay}>
            Pay now
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function BillingSettingsPage() {
  const { data: currentUser } = useCurrentUser();
  const { data, isLoading, isError } = useBilling();
  const subscribe = useSubscribe();
  const pay = usePayInvoice();
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  // Coming back from the payment page.
  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get("payment");
    if (!outcome) return;
    if (outcome === "success") toast.success("Payment received. Your plan is active.");
    else if (outcome === "cancelled") toast.message("Payment cancelled. You have not been charged.");
    else toast.error("The payment did not go through. You have not been charged.");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  if (currentUser && !can(currentUser, "settings.manage")) return <PermissionDenied />;

  if (isLoading) return <Skeleton className="h-64 w-full max-w-4xl" />;
  if (isError || !data)
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load billing.</AlertDescription>
      </Alert>
    );

  const sub = data.subscription;
  const status = sub ? STATUS[sub.status] : null;
  const openInvoice = data.invoices.find((invoice) => invoice.status === "open");
  const nearLimit = data.usage.find((u) => u.limit !== null && u.limit > 0 && u.used / u.limit >= 0.9);

  return (
    <div className="max-w-4xl space-y-6">
      {sub && (sub.status === "past_due" || sub.status === "suspended") ? (
        <Alert variant="danger">
          <AlertDescription>
            {sub.status === "suspended"
              ? "Your store is paused because your subscription is unpaid. Pay your invoice to bring it back online."
              : `Your payment is overdue.${sub.grace_ends_at ? ` Pay by ${date(sub.grace_ends_at)} to keep your store online.` : ""}`}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="space-y-3 pt-6">
          {sub && status ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">{sub.plan.name}</span>
                <Badge variant={status.variant}>{status.label}</Badge>
                {sub.trial_days_left !== null ? <Badge variant="warning">{sub.trial_days_left} days left</Badge> : null}
              </div>
              <p className="text-sm text-text-secondary">
                {sub.status === "trialing"
                  ? "Pick a plan before your trial ends to keep your store online. Nothing is charged until you do."
                  : sub.cancel_at_period_end
                    ? `Your subscription ends on ${date(sub.current_period_end)}.`
                    : sub.current_period_end
                      ? `Renews on ${date(sub.current_period_end)}.`
                      : ""}
                {sub.pending_plan ? ` Switching to ${sub.pending_plan.name} at the end of the period.` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {openInvoice ? (
                  <Button size="sm" disabled={pay.isPending} onClick={() => pay.mutate(openInvoice.id)}>
                    Pay invoice {openInvoice.number}
                  </Button>
                ) : null}
                {sub.status === "active" && !sub.cancel_at_period_end ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cancel.isPending}
                    onClick={() => {
                      if (window.confirm("Cancel at the end of the current period?")) cancel.mutate();
                    }}
                  >
                    Cancel subscription
                  </Button>
                ) : null}
                {sub.cancel_at_period_end ? (
                  <Button size="sm" variant="outline" disabled={resume.isPending} onClick={() => resume.mutate()}>
                    Keep my subscription
                  </Button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-text-secondary">No plan limits apply to this account.</p>
          )}
          {data.manual_instructions ? <p className="rounded-md border border-border bg-background p-3 text-sm">{data.manual_instructions}</p> : null}
        </CardContent>
      </Card>

      {sub ? (
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-6 sm:grid-cols-2">
              {data.usage.map((u) => (
                <div key={u.resource} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{USAGE_LABEL[u.resource]}</span>
                    <span className={u.limit && u.used / u.limit >= 0.9 ? "font-semibold text-danger" : "text-text-secondary"}>
                      {u.used} / {u.limit ?? "unlimited"}
                    </span>
                  </div>
                  <Meter used={u.used} limit={u.limit} />
                </div>
              ))}
            </div>
            {nearLimit ? (
              <p className="text-sm text-danger">
                You are close to your {USAGE_LABEL[nearLimit.resource].toLowerCase()} limit. Upgrade to keep going without interruption.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Plans</h2>
          <div className="inline-flex rounded-md border border-border p-0.5 text-sm">
            {(["monthly", "yearly"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCycle(value)}
                className={`rounded px-3 py-1 ${cycle === value ? "bg-primary text-white" : "text-text-secondary"}`}
              >
                {value === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {data.plans.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              cycle={cycle}
              current={sub?.plan.key === plan.key && sub.status !== "trialing" && sub.billing_cycle === cycle}
              busy={subscribe.isPending}
              onChoose={() => subscribe.mutate({ plan: plan.key, cycle })}
            />
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.invoices.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-text-secondary">No invoices yet. They appear here once you choose a plan.</p>
          ) : (
            data.invoices.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} busy={pay.isPending} onPay={() => pay.mutate(invoice.id)} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
