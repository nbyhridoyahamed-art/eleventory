"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Package, Pencil, Plus, Trash2, Upload } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { useAllBrands } from "@/hooks/use-brands";
import { useDeleteProduct, useExportProducts, useProducts } from "@/hooks/use-products";
import { ProductImportDialog } from "@/components/catalog/product-import-dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/money";
import type { Product } from "@/types/product";

const STATUS_VARIANT: Record<string, "success" | "warning" | "neutral"> = {
  active: "success",
  draft: "warning",
  archived: "neutral",
};

export default function ProductsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [brandId, setBrandId] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: categories } = useCategories(storeId);
  const { data: brandsData } = useAllBrands(storeId);
  const filters = {
    search,
    categoryId: categoryId !== "all" ? Number(categoryId) : null,
    brandId: brandId !== "all" ? Number(brandId) : null,
    status: status !== "all" ? status : null,
  };
  const { data, isLoading } = useProducts(storeId, { page, ...filters });
  const deleteProduct = useDeleteProduct();
  const exportProducts = useExportProducts();

  if (currentUser && !can(currentUser, "products.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "products.create");
  const canDelete = can(currentUser, "products.delete");

  const columns: DataTableColumn<Product>[] = [
    {
      id: "name",
      header: "Product",
      cell: (product) => {
        const primaryImage = product.images.find((i) => i.is_primary) ?? product.images[0];
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-border/20">
              {primaryImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
                <img src={primaryImage.url} alt="" className="size-full object-cover" />
              ) : (
                <Package className="size-4 text-text-muted" />
              )}
            </div>
            <div>
              <p className="font-medium">{product.name}</p>
              <p className="text-xs text-text-muted">{product.sku}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: "seo",
      header: "SEO",
      cell: (product) => <SeoScoreBadge seo={product.seo} />,
    },
    { id: "category", header: "Category", cell: (product) => product.category?.name ?? "—" },
    {
      id: "view",
      header: "View",
      cell: (product) => (
        <ViewOnSiteLink
          href={`/products/${product.slug}`}
          visible={product.status === "active"}
          label={product.name}
          hiddenReason="This product isn't active, so it isn't on the storefront"
        />
      ),
    },
    {
      id: "price",
      header: "Price",
      className: "whitespace-nowrap",
      cell: (product) => (
        <div>
          {product.sale_price ? (
            <>
              <span className="font-medium">{formatMoney(product.sale_price, product.currency_code)}</span>{" "}
              <span className="text-xs text-text-muted line-through">
                {formatMoney(product.price, product.currency_code)}
              </span>
            </>
          ) : (
            <span className="font-medium">{formatMoney(product.price, product.currency_code)}</span>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (product) => <Badge variant={STATUS_VARIANT[product.status]}>{product.status}</Badge>,
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (product) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${product.name}`}>
            <Link href={`/dashboard/catalog/products/${product.id}`}>
              <Pencil />
            </Link>
          </Button>
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${product.name}`}
              onClick={() => setProductToDelete(product)}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={categoryId}
            onValueChange={(value) => {
              setCategoryId(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={brandId}
            onValueChange={(value) => {
              setBrandId(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filter by brand">
              <SelectValue placeholder="All brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {(brandsData?.data ?? []).map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            loading={exportProducts.isPending}
            onClick={() => storeId && exportProducts.mutate({ storeId, filters })}
          >
            <Download />
            Export
          </Button>
          {canCreate ? (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload />
              Import
            </Button>
          ) : null}
          {canCreate ? (
            <Button asChild>
              <Link href="/dashboard/catalog/products/new">
                <Plus />
                Add product
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(product) => product.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={<Package />}
            title="No products yet"
            description="Add your first product to start managing your catalog."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/catalog/products/new">Add product</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(productToDelete)} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete product</DialogTitle>
            <DialogDescription>
              This will permanently remove {productToDelete?.name} and its images. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteProduct.isPending}
              onClick={() => {
                if (productToDelete) {
                  deleteProduct.mutate(productToDelete.id, {
                    onSuccess: () => setProductToDelete(null),
                  });
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {storeId ? (
        <ProductImportDialog storeId={storeId} open={importOpen} onClose={() => setImportOpen(false)} />
      ) : null}
    </div>
  );
}
