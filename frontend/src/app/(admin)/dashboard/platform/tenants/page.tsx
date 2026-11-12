"use client";

import Link from "next/link";
import { useState } from "react";

import { useTenants } from "@/hooks/use-platform";
import { TenantStatusBadge } from "@/components/platform/status-badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlatformTenantsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { data, isLoading } = useTenants(search, status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input className="max-w-xs" placeholder="Search name, address, owner email" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search shops" />
        <select className="rounded-md border border-border bg-surface px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-background text-left text-text-secondary">
              <tr>
                {["Shop", "Owner", "Plan", "Status", "Joined"].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((tenant) => (
                <tr key={tenant.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/platform/tenants/${tenant.id}`} className="font-medium text-primary hover:underline">{tenant.name}</Link>
                    <div className="text-xs text-text-secondary">{tenant.domain ?? tenant.slug}</div>
                  </td>
                  <td className="px-4 py-3">{tenant.owner_email ?? "—"}</td>
                  <td className="px-4 py-3">{tenant.plan?.name ?? "—"}</td>
                  <td className="px-4 py-3"><TenantStatusBadge tenant={tenant} /></td>
                  <td className="px-4 py-3 text-text-secondary">{tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : ""}</td>
                </tr>
              ))}
              {data && data.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-text-secondary">No shops match.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
