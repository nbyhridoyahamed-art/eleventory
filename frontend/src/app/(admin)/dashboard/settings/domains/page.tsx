"use client";

import { useState } from "react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useAddDomain,
  useDomains,
  useMakePrimaryDomain,
  useRemoveDomain,
  useVerifyDomain,
  type StoreDomain,
} from "@/hooks/use-domains";
import { PermissionDenied } from "@/components/permission-denied";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS: Record<StoreDomain["status"], { label: string; variant: "success" | "warning" | "danger" }> = {
  active: { label: "Connected", variant: "success" },
  pending: { label: "Waiting for DNS", variant: "warning" },
  failed: { label: "Needs attention", variant: "danger" },
};

function when(value: string | null) {
  return value ? new Date(value).toLocaleString() : null;
}

/** The DNS records a shop owner must add, shown until the domain is connected. */
function DnsInstructions({ domain, cnameTarget }: { domain: StoreDomain; cnameTarget: string | null }) {
  const rows = [
    { type: "TXT", name: domain.verification.name, value: domain.verification.value, why: "Proves the domain is yours." },
    ...(cnameTarget
      ? [{ type: "CNAME", name: domain.domain, value: cnameTarget, why: "Sends visitors to your store. (On a bare domain such as example.com, use your provider's ALIAS/ANAME option, or point www and redirect the bare domain.)" }]
      : []),
  ];

  return (
    <div className="space-y-3 border-t border-border bg-background px-6 py-4">
      <p className="text-sm text-text-secondary">
        At your domain provider, add {rows.length === 1 ? "this record" : "these records"}. It can take up to a few hours
        to take effect, then press <strong>Check now</strong>.
      </p>
      <div className="overflow-x-auto rounded-md border border-border bg-surface text-sm">
        <div className="grid min-w-[560px] grid-cols-[80px_1fr_1fr] gap-3 bg-background px-3.5 py-2.5 font-semibold text-text-secondary">
          <span>Type</span>
          <span>Name</span>
          <span>Value</span>
        </div>
        {rows.map((row) => (
          <div key={row.type} className="grid min-w-[560px] grid-cols-[80px_1fr_1fr] gap-3 border-t border-border px-3.5 py-3">
            <span className="font-mono text-xs">{row.type}</span>
            <span className="break-all font-mono text-xs">{row.name}</span>
            <span className="break-all font-mono text-xs">{row.value}</span>
            <span className="col-span-3 text-xs text-text-secondary">{row.why}</span>
          </div>
        ))}
      </div>
      {domain.last_error ? <p className="text-xs text-danger">{domain.last_error}</p> : null}
      {domain.last_checked_at ? (
        <p className="text-xs text-text-secondary">Last checked {when(domain.last_checked_at)}.</p>
      ) : null}
    </div>
  );
}

export default function DomainsSettingsPage() {
  const { data: currentUser } = useCurrentUser();
  const { data, isLoading, isError } = useDomains();
  const add = useAddDomain();
  const verify = useVerifyDomain();
  const makePrimary = useMakePrimaryDomain();
  const remove = useRemoveDomain();
  const [input, setInput] = useState("");

  if (currentUser && !can(currentUser, "settings.manage")) {
    return <PermissionDenied />;
  }

  if (isLoading || !currentUser) {
    return (
      <div className="max-w-4xl space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load your domains. Please try again.</AlertDescription>
      </Alert>
    );
  }

  const atLimit = data.domains.length >= data.limit;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const domain = input.trim();
    if (!domain) return;
    add.mutate(domain, { onSuccess: () => setInput("") });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-sm text-text-secondary">
        Choose the addresses shoppers use to reach your store. HTTPS is set up for you once a domain is connected.
      </p>

      {data.free_address ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div>
              <div className="text-xs text-text-secondary">Free address</div>
              <div className="font-semibold">{data.free_address}</div>
            </div>
            <Badge variant="success">Always on</Badge>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Custom domains</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1 space-y-1.5">
              <Label htmlFor="new-domain">Add a domain</Label>
              <Input
                id="new-domain"
                placeholder="shop.example.com"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={atLimit}
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <Button type="submit" loading={add.isPending} disabled={atLimit || input.trim() === ""}>
              Add domain
            </Button>
          </form>
          {atLimit ? <p className="text-xs text-text-secondary">You can connect up to {data.limit} domains.</p> : null}
        </CardContent>

        {data.domains.length === 0 ? (
          <CardContent className="border-t border-border py-8 text-center text-sm text-text-secondary">
            No custom domains yet.
          </CardContent>
        ) : (
          <CardContent className="divide-y divide-border border-t border-border p-0">
            {data.domains.map((domain) => {
              const status = STATUS[domain.status];

              return (
                <div key={domain.id}>
                  <div className="flex flex-wrap items-center gap-3 px-6 py-4">
                    <div className="min-w-60 flex-1">
                      <div className="break-all font-semibold">{domain.domain}</div>
                      <div className="text-xs text-text-secondary">
                        {domain.is_primary ? "Primary · " : ""}
                        {domain.status === "active"
                          ? `Connected ${when(domain.verified_at) ?? ""}`
                          : `Added ${when(domain.created_at) ?? ""}`}
                      </div>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {domain.status === "active" && domain.points_here === false ? (
                      <Badge variant="warning">Not pointing here yet</Badge>
                    ) : null}
                    <div className="flex gap-2">
                      {domain.status !== "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={verify.isPending && verify.variables === domain.id}
                          onClick={() => verify.mutate(domain.id)}
                        >
                          Check now
                        </Button>
                      ) : null}
                      {domain.status === "active" && !domain.is_primary ? (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={makePrimary.isPending && makePrimary.variables === domain.id}
                          onClick={() => makePrimary.mutate(domain.id)}
                        >
                          Make primary
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        loading={remove.isPending && remove.variables === domain.id}
                        onClick={() => {
                          if (window.confirm(`Remove ${domain.domain}? Visitors using it will no longer reach your store.`)) {
                            remove.mutate(domain.id);
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  {domain.status !== "active" ? <DnsInstructions domain={domain} cnameTarget={data.cname_target} /> : null}
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      <p className="text-xs text-text-secondary">
        Visitors who use any other address of your store, including the free one, are sent to your primary domain.
      </p>
    </div>
  );
}
