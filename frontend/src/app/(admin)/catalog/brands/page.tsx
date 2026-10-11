"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, Pencil, Plus, Trash2 } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useBrands, useDeleteBrand } from "@/hooks/use-brands";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SeoScoreBadge } from "@/components/shared/seo-score-badge";
import { ViewOnSiteLink } from "@/components/shared/view-on-site-link";
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
import type { Brand } from "@/types/brand";

export default function BrandsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);

  const { data, isLoading } = useBrands(storeId, page, search);
  const deleteBrand = useDeleteBrand();

  if (currentUser && !can(currentUser, "brands.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "brands.create");
  const canDelete = can(currentUser, "brands.delete");

  const columns: DataTableColumn<Brand>[] = [
    {
      id: "name",
      header: "Name",
      cell: (brand) => (
        <div className="flex items-center gap-2">
          {brand.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
            <img src={brand.logo_url} alt="" className="size-8 rounded-full object-cover" />
          ) : null}
          <span className="font-medium">{brand.name}</span>
        </div>
      ),
    },
    {
      id: "seo",
      header: "SEO",
      cell: (brand) => <SeoScoreBadge seo={brand.seo} />,
    },
    { id: "slug", header: "Slug", cell: (brand) => brand.slug },
    {
      id: "view",
      header: "View",
      cell: (brand) => (
        <ViewOnSiteLink
          href={`/brand/${brand.slug}`}
          visible={brand.status === "active"}
          label={brand.name}
          hiddenReason="This brand is inactive, so it isn't on the storefront"
        />
      ),
    },
    { id: "products", header: "Products", cell: (brand) => brand.products_count ?? 0 },
    {
      id: "status",
      header: "Status",
      cell: (brand) => <Badge variant={brand.status === "active" ? "success" : "warning"}>{brand.status}</Badge>,
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (brand) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${brand.name}`}>
            <Link href={`/catalog/brands/${brand.id}`}>
              <Pencil />
            </Link>
          </Button>
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${brand.name}`}
              onClick={() => setBrandToDelete(brand)}
            >
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
          placeholder="Search brands..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        {canCreate ? (
          <Button asChild>
            <Link href="/catalog/brands/new">
              <Plus />
              Add brand
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(brand) => brand.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={<Award />}
            title="No brands yet"
            description="Add the brands your store carries so products can be filtered by them."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/catalog/brands/new">Add brand</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(brandToDelete)} onOpenChange={(open) => !open && setBrandToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete brand</DialogTitle>
            <DialogDescription>
              {brandToDelete && (brandToDelete.products_count ?? 0) > 0
                ? `${brandToDelete.products_count} product(s) are assigned to this brand. Deleting it will not delete those products, but they will lose this brand.`
                : "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrandToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteBrand.isPending}
              onClick={() => {
                if (brandToDelete) {
                  deleteBrand.mutate(brandToDelete.id, {
                    onSuccess: () => setBrandToDelete(null),
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
