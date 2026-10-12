"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Crown, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { cn, timeAgo } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCustomers, useCustomerSummary, useDeleteCustomer } from "@/hooks/use-customers";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { Customer, CustomerSegmentKey } from "@/types/customer";

const SEGMENT_STYLE: Record<CustomerSegmentKey, { label: string; variant: BadgeProps["variant"]; color: string }> = {
  vip: { label: "VIP", variant: "success", color: "#16a34a" },
  repeat: { label: "Repeat buyer", variant: "info", color: "#2563eb" },
  one_time: { label: "One-time buyer", variant: "neutral", color: "#64748b" },
  at_risk: { label: "At risk", variant: "warning", color: "#f59e0b" },
  inactive: { label: "Inactive", variant: "danger", color: "#e11d48" },
  new: { label: "No orders yet", variant: "neutral", color: "#94a3b8" },
};

const SORTS: Record<string, string> = {
  name: "Name (A–Z)",
  spend: "Highest spend",
  orders: "Most orders",
  recent: "Most recent order",
  joined: "Newest customers",
};

function Initials({ name }: { name: string }) {
  const letters = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {letters || "?"}
    </span>
  );
}

function Tile({ label, value, footnote, trend }: { label: string; value: string; footnote?: string; trend?: number | null }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{value}</p>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
        {trend !== undefined && trend !== null ? (
          <span className={cn("inline-flex items-center font-medium", trend >= 0 ? "text-success" : "text-danger")}>
            {trend >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(trend)}%
          </span>
        ) : null}
        {footnote}
      </p>
    </div>
  );
}

export default function CustomersPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const [sort, setSort] = useState("name");
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const { data, isLoading } = useCustomers(storeId, page, search, {
    segment: segment === "all" ? undefined : segment,
    sort: sort === "name" ? undefined : sort,
    direction: "desc",
  });
  const { data: summary } = useCustomerSummary(storeId);
  const deleteCustomer = useDeleteCustomer();

  if (currentUser && !can(currentUser, "customers.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "customers.create");
  const canDelete = can(currentUser, "customers.delete");

  const growth =
    summary && summary.new_previous_30_days > 0
      ? Math.round(((summary.new_30_days - summary.new_previous_30_days) / summary.new_previous_30_days) * 1000) / 10
      : null;

  const donut = (summary?.segments ?? []).filter((s) => s.count > 0).map((s) => ({ name: SEGMENT_STYLE[s.key].label, value: s.count, color: SEGMENT_STYLE[s.key].color }));

  const columns: DataTableColumn<Customer>[] = [
    {
      id: "customer",
      header: "Customer",
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Initials name={c.name} />
          <div className="min-w-0">
            <Link href={`/dashboard/orders/customers/${c.id}`} className="font-medium text-text-primary hover:text-primary">
              {c.name}
            </Link>
            <p className="truncate text-xs text-text-muted">
              {c.phone}
              {c.email ? ` · ${c.email}` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "segment",
      header: "Segment",
      cell: (c) =>
        c.segment ? <Badge variant={SEGMENT_STYLE[c.segment].variant}>{SEGMENT_STYLE[c.segment].label}</Badge> : "—",
    },
    { id: "orders", header: "Orders", cell: (c) => <span className="tabular-nums">{c.active_orders_count ?? c.orders_count ?? 0}</span> },
    {
      id: "spend",
      header: "Lifetime spend",
      cell: (c) => <span className="font-medium tabular-nums">{formatMoney(c.lifetime_spend ?? 0, "BDT")}</span>,
    },
    {
      id: "aov",
      header: "Avg. order",
      cell: (c) => <span className="tabular-nums text-text-secondary">{c.average_order_value ? formatMoney(c.average_order_value, "BDT") : "—"}</span>,
    },
    {
      id: "last",
      header: "Last order",
      cell: (c) => (c.last_order_at ? <span title={new Date(c.last_order_at).toLocaleString()}>{timeAgo(c.last_order_at)}</span> : "—"),
    },
    {
      id: "joined",
      header: "Joined",
      cell: (c) => new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    },
    {
      id: "account",
      header: "Account",
      cell: (c) => <Badge variant={c.has_account ? "info" : "neutral"}>{c.has_account ? "Registered" : "Guest"}</Badge>,
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${c.name}`}>
            <Link href={`/dashboard/orders/customers/${c.id}`}>
              <Pencil />
            </Link>
          </Button>
          {canDelete ? (
            <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={() => setCustomerToDelete(c)}>
              <Trash2 className="text-danger" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Summary */}
      {summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Total customers" value={summary.total_customers.toLocaleString("en-US")} footnote={`${summary.with_orders.toLocaleString("en-US")} have ordered`} />
          <Tile
            label="New in 30 days"
            value={summary.new_30_days.toLocaleString("en-US")}
            trend={growth}
            footnote={growth === null ? "no prior period" : "vs previous 30 days"}
          />
          <Tile label="Repeat purchase rate" value={`${summary.repeat_rate}%`} footnote="of buyers ordered 2+ times" />
          <Tile
            label="Average lifetime value"
            value={formatMoney(summary.average_lifetime_value, "BDT")}
            footnote={`${formatMoney(summary.total_lifetime_value, "BDT")} in total`}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {summary ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Customer segments</CardTitle>
            </CardHeader>
            <CardContent>
              {donut.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">No customers yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={donut} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">
                      {donut.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="size-4 text-warning" /> Top customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary.top_customers.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">Spending leaders appear here after the first orders.</p>
              ) : (
                <ol className="divide-y divide-border">
                  {summary.top_customers.map((c, index) => (
                    <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="w-5 text-center text-xs font-semibold text-text-muted">{index + 1}</span>
                      <Initials name={c.name} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/dashboard/orders/customers/${c.id}`} className="font-medium text-text-primary hover:text-primary">
                          {c.name}
                        </Link>
                        <p className="text-xs text-text-muted">
                          {c.phone} · {c.orders_count} order{c.orders_count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums">{formatMoney(c.lifetime_spend, "BDT")}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Segment chips */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by segment">
        {[{ key: "all", label: "All customers", count: summary?.total_customers }, ...(summary?.segments ?? [])].map((chip) => (
          <button
            key={chip.key}
            type="button"
            aria-pressed={segment === chip.key}
            onClick={() => {
              setSegment(chip.key);
              setPage(1);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              segment === chip.key
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-text-secondary hover:text-text-primary",
            )}
          >
            {chip.label}
            {chip.count !== undefined ? <span className="ml-1.5 tabular-nums text-text-muted">{chip.count}</span> : null}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search name, phone or email…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-72"
          />
          <Select
            value={sort}
            onValueChange={(value) => {
              setSort(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48" aria-label="Sort customers">
              <SelectValue>{SORTS[sort]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORTS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/orders/customers/new">
              <Plus />
              Add customer
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(c) => c.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={segment === "all" ? <Users /> : <UserPlus />}
            title={segment === "all" ? "No customers yet" : "No customers in this segment"}
            description={segment === "all" ? "Add a customer before creating your first order." : "Try another segment or clear the search."}
            action={
              canCreate && segment === "all" ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/orders/customers/new">Add customer</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(customerToDelete)} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete customer</DialogTitle>
            <DialogDescription>
              {customerToDelete && (customerToDelete.orders_count ?? 0) > 0
                ? `${customerToDelete.orders_count} order(s) reference this customer. Deleting it will not delete those orders, but they will keep a record of a now-deleted customer.`
                : "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteCustomer.isPending}
              onClick={() => {
                if (customerToDelete) {
                  deleteCustomer.mutate(customerToDelete.id, {
                    onSuccess: () => setCustomerToDelete(null),
                  });
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
