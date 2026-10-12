"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCategories, useDeleteCategory } from "@/hooks/use-categories";
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
import { buildCategoryTree, flattenCategoryTree, type Category, type CategoryTreeNode } from "@/types/category";

export default function CategoriesPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const { data: categories, isLoading } = useCategories(storeId);
  const deleteCategory = useDeleteCategory();

  if (currentUser && !can(currentUser, "categories.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "categories.create");
  const canDelete = can(currentUser, "categories.delete");

  const rows = flattenCategoryTree(buildCategoryTree(categories ?? []));

  const columns: DataTableColumn<CategoryTreeNode>[] = [
    {
      id: "name",
      header: "Name",
      cell: (category) => (
        <div className="flex items-center gap-2" style={{ paddingLeft: category.depth * 20 }}>
          {category.depth > 0 ? <span className="text-text-muted">&#8627;</span> : null}
          <span className="font-medium">{category.name}</span>
        </div>
      ),
    },
    {
      id: "seo",
      header: "SEO",
      cell: (category) => <SeoScoreBadge seo={category.seo} />,
    },
    { id: "slug", header: "Slug", cell: (category) => category.slug },
    {
      id: "view",
      header: "View",
      cell: (category) => (
        <ViewOnSiteLink
          href={`/category/${category.slug}`}
          visible={category.status === "active"}
          label={category.name}
          hiddenReason="This category is inactive, so it isn't on the storefront"
        />
      ),
    },
    { id: "products", header: "Products", cell: (category) => category.products_count ?? 0 },
    {
      id: "status",
      header: "Status",
      cell: (category) => (
        <Badge variant={category.status === "active" ? "success" : "warning"}>{category.status}</Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (category) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${category.name}`}>
            <Link href={`/dashboard/catalog/categories/${category.id}`}>
              <Pencil />
            </Link>
          </Button>
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${category.name}`}
              onClick={() => setCategoryToDelete(category)}
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
      <div className="flex justify-end">
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/catalog/categories/new">
              <Plus />
              Add category
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(category) => category.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={<FolderTree />}
            title="No categories yet"
            description="Organize your products into categories so customers can browse them."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/catalog/categories/new">Add category</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(categoryToDelete)} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete category</DialogTitle>
            <DialogDescription>
              {categoryToDelete && (categoryToDelete.products_count ?? 0) > 0
                ? `${categoryToDelete.products_count} product(s) are assigned to this category. Deleting it will not delete those products, but they will lose this category.`
                : "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteCategory.isPending}
              onClick={() => {
                if (categoryToDelete) {
                  deleteCategory.mutate(categoryToDelete.id, {
                    onSuccess: () => setCategoryToDelete(null),
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
