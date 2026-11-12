"use client";

import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import {
  useAddTenantNote,
  useRestoreTenant,
  useSetTenantOverrides,
  useSetTenantPlan,
  useSuspendTenant,
  useTenant,
} from "@/hooks/use-platform";
import { TenantStatusBadge } from "@/components/platform/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const LIMITS = ["products", "staff", "orders_per_month", "custom_domains", "storage_mb"] as const;

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const id = Number(rawId);
  const { data: tenant, isLoading } = useTenant(id);
  const suspend = useSuspendTenant(id);
  const restore = useRestoreTenant(id);
  const setPlan = useSetTenantPlan(id);
  const setOverrides = useSetTenantOverrides(id);
  const addNote = useAddTenantNote(id);

  const [plan, setPlanKey] = useState("");
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [limits, setLimits] = useState<Record<string, string> | null>(null);

  if (isLoading || !tenant) return <Skeleton className="h-64 w-full" />;

  const limitDraft = limits ?? Object.fromEntries(LIMITS.map((key) => [key, tenant.overrides.limits[key] === undefined ? "" : String(tenant.overrides.limits[key] ?? "")]));

  async function openAsSupport() {
    try {
      await api.post(`/platform/tenants/${id}/enter`);
      window.location.assign("/dashboard");
    } catch {
      toast.error("Could not open this shop.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/platform/tenants" className="text-sm text-primary hover:underline">← All shops</Link>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold">
            {tenant.name} <TenantStatusBadge tenant={tenant} />
          </h2>
          <p className="text-sm text-text-secondary">{tenant.domain ?? tenant.slug} · {tenant.owner_email ?? "no owner email"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openAsSupport}>Open as support</Button>
          {tenant.status === "active" ? (
            <Button
              variant="outline"
              disabled={suspend.isPending}
              onClick={() => {
                const reason = window.prompt("Why is this shop being suspended? (recorded in the audit log)");
                if (reason?.trim()) suspend.mutate(reason.trim());
              }}
            >
              Suspend
            </Button>
          ) : (
            <Button disabled={restore.isPending} onClick={() => restore.mutate()}>Restore</Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Plan</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              {tenant.plan?.name ?? "No plan"} · {tenant.subscription_status ?? "no subscription"}
              {tenant.current_period_end ? ` · until ${new Date(tenant.current_period_end).toLocaleDateString()}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <select className="rounded-md border border-border bg-surface px-3 py-2" value={plan} onChange={(e) => setPlanKey(e.target.value)} aria-label="Plan">
                <option value="">Choose a plan…</option>
                {tenant.plans.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
              <Input className="w-24" placeholder="Days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} aria-label="Days" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={!plan || setPlan.isPending} onClick={() => setPlan.mutate({ plan, status: "active", days: days ? Number(days) : undefined })}>
                Grant as active
              </Button>
              <Button size="sm" variant="outline" disabled={!plan || setPlan.isPending} onClick={() => setPlan.mutate({ plan, status: "trialing", days: days ? Number(days) : undefined })}>
                Set as trial
              </Button>
            </div>
            <p className="text-xs text-text-secondary">No payment is taken. Days default to 30 (active) or the trial length.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Usage and limit overrides</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {LIMITS.map((key) => {
              const usage = tenant.usage.find((u) => u.resource === key);
              return (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{key.replace(/_/g, " ")} <span className="text-text-secondary">({usage?.used ?? 0} / {usage?.limit ?? "unlimited"})</span></span>
                  <Input
                    className="w-24"
                    placeholder="plan"
                    inputMode="numeric"
                    value={limitDraft[key]}
                    onChange={(e) => setLimits({ ...limitDraft, [key]: e.target.value.replace(/\D/g, "") })}
                    aria-label={`Override ${key}`}
                  />
                </div>
              );
            })}
            <Button
              size="sm"
              disabled={setOverrides.isPending}
              onClick={() =>
                setOverrides.mutate({
                  limits: Object.fromEntries(LIMITS.filter((k) => limitDraft[k] !== "").map((k) => [k, Number(limitDraft[k])])),
                  features: tenant.overrides.features,
                })
              }
            >
              Save overrides
            </Button>
            <p className="text-xs text-text-secondary">Leave a box empty to follow the plan.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Support notes</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (only platform staff see this)" aria-label="Note" />
            <Button disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate(note.trim(), { onSuccess: () => setNote("") })}>Add</Button>
          </div>
          {tenant.notes.length === 0 ? <p className="text-text-secondary">No notes yet.</p> : null}
          {tenant.notes.map((n) => (
            <div key={n.id} className="rounded-md border border-border p-3">
              <p>{n.body}</p>
              <p className="mt-1 text-xs text-text-secondary">{n.author ?? "Unknown"} · {n.created_at ? new Date(n.created_at).toLocaleString() : ""}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent invoices</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {tenant.invoices.length === 0 ? <p className="text-text-secondary">None.</p> : tenant.invoices.map((i) => (
            <div key={i.id} className="flex justify-between border-t border-border py-2 first:border-t-0">
              <span>{i.number}</span>
              <span>{i.currency} {i.amount.toLocaleString()} · {i.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
