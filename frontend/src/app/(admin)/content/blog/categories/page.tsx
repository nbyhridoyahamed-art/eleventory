"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useBlogCategories, useDeleteBlogCategory } from "@/hooks/use-blog-categories";
import { PermissionDenied } from "@/components/permission-denied";
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
import type { BlogCategory } from "@/types/blog-category";

export default function BlogCategoriesPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [categoryToDelete, setCategoryToDelete] = useState<BlogCategory | null>(null);

  const { data: categories, isLoading } = useBlogCategories(storeId);
  const deleteCategory = useDeleteBlogCategory();

  if (currentUser && !can(currentUser, "blog.manage")) {
    return <PermissionDenied />;
  }

  const columns: DataTableColumn<BlogCategory>[] = [
    { id: "name", header: "Name", cell: (category) => <span className="font-medium">{category.name}</span> },
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
          href={`/blog/category/${category.slug}`}
          visible={true}
          label={category.name}
        />
      ),
    },
    { id: "posts", header: "Posts", cell: (category) => category.posts_count ?? 0 },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (category) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${category.name}`}>
            <Link href={`/content/blog/categories/${category.id}`}>
              <Pencil />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${category.name}`}
            onClick={() => setCategoryToDelete(category)}
          >
            <Trash2 className="text-danger" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/content/blog/categories/new">
            <Plus />
            Add category
          </Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={categories ?? []}
        rowKey={(category) => category.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={<FolderTree />}
            title="No categories yet"
            description="Group your blog posts into topics like Guides, News, or Behind the Scenes."
            action={
              <Button asChild size="sm">
                <Link href="/content/blog/categories/new">Add category</Link>
              </Button>
            }
          />
        }
      />

      <Dialog open={Boolean(categoryToDelete)} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete category</DialogTitle>
            <DialogDescription>
              {categoryToDelete && (categoryToDelete.posts_count ?? 0) > 0
                ? `${categoryToDelete.posts_count} post(s) are assigned to this category. Deleting it will not delete those posts, but they will lose this category.`
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
                  deleteCategory.mutate(categoryToDelete.id, { onSuccess: () => setCategoryToDelete(null) });
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
