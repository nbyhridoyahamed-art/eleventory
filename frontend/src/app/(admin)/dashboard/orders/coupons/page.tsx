"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCoupons, useDeleteCoupon } from "@/hooks/use-coupons";
import { formatMoney } from "@/lib/money";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { Coupon } from "@/types/coupon";

export default function CouponsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);

  const { data, isLoading } = useCoupons(storeId, page, search);
  const deleteCoupon = useDeleteCoupon();

  if (currentUser && !can(currentUser, "coupons.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "coupons.create");
  const canDelete = can(currentUser, "coupons.delete");

  const columns: DataTableColumn<Coupon>[] = [
    { id: "code", header: "Code", cell: (c) => <span className="font-medium">{c.code}</span> },
    {
      id: "discount",
      header: "Discount",
      cell: (c) =>
        c.discount_type === "percentage"
          ? `${c.percentage_value}% off`
          : `${formatMoney(c.fixed_amount ?? 0, c.currency_code)} off`,
    },
    {
      id: "usage",
      header: "Used",
      cell: (c) => `${c.used_count}${c.usage_limit ? ` / ${c.usage_limit}` : ""}`,
    },
    {
      id: "expires",
      header: "Expires",
      cell: (c) => (c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"),
    },
    {
      id: "status",
      header: "Status",
      cell: (c) => <Badge variant={c.status === "active" ? "success" : "warning"}>{c.status}</Badge>,
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${c.code}`}>
            <Link href={`/dashboard/orders/coupons/${c.id}`}>
              <Pencil />
            </Link>
          </Button>
          {canDelete ? (
            <Button variant="ghost" size="icon" aria-label={`Delete ${c.code}`} onClick={() => setCouponToDelete(c)}>
              <Trash2 className="text-danger" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search coupon codes..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/orders/coupons/new">
              <Plus />
              Add coupon
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
            icon={<Tag />}
            title="No coupons yet"
            description="Create a discount code customers or staff can apply at checkout."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/orders/coupons/new">Add coupon</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(couponToDelete)} onOpenChange={(open) => !open && setCouponToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete coupon</DialogTitle>
            <DialogDescription>
              {couponToDelete && couponToDelete.used_count > 0
                ? `This coupon has already been used ${couponToDelete.used_count} time(s). Deleting it will not affect past orders, which keep their own discount record.`
                : "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteCoupon.isPending}
              onClick={() => {
                if (couponToDelete) {
                  deleteCoupon.mutate(couponToDelete.id, {
                    onSuccess: () => setCouponToDelete(null),
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
