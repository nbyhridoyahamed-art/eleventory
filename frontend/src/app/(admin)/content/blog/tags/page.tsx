"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Tag as TagIcon, Trash2 } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useBlogTags, useDeleteBlogTag } from "@/hooks/use-blog-tags";
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
import type { BlogTag } from "@/types/blog-tag";

export default function BlogTagsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [tagToDelete, setTagToDelete] = useState<BlogTag | null>(null);

  const { data: tags, isLoading } = useBlogTags(storeId);
  const deleteTag = useDeleteBlogTag();

  if (currentUser && !can(currentUser, "blog.manage")) {
    return <PermissionDenied />;
  }

  const columns: DataTableColumn<BlogTag>[] = [
    { id: "name", header: "Name", cell: (tag) => <span className="font-medium">{tag.name}</span> },
    {
      id: "seo",
      header: "SEO",
      cell: (tag) => <SeoScoreBadge seo={tag.seo} />,
    },
    { id: "slug", header: "Slug", cell: (tag) => tag.slug },
    {
      id: "view",
      header: "View",
      cell: (tag) => (
        <ViewOnSiteLink
          href={`/blog/tag/${tag.slug}`}
          visible={true}
          label={tag.name}
        />
      ),
    },
    { id: "posts", header: "Posts", cell: (tag) => tag.posts_count ?? 0 },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (tag) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${tag.name}`}>
            <Link href={`/content/blog/tags/${tag.id}`}>
              <Pencil />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Delete ${tag.name}`} onClick={() => setTagToDelete(tag)}>
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
          <Link href="/content/blog/tags/new">
            <Plus />
            Add tag
          </Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={tags ?? []}
        rowKey={(tag) => tag.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={<TagIcon />}
            title="No tags yet"
            description="Tags help readers find related posts across categories, like Eid or Checkout Tips."
            action={
              <Button asChild size="sm">
                <Link href="/content/blog/tags/new">Add tag</Link>
              </Button>
            }
          />
        }
      />

      <Dialog open={Boolean(tagToDelete)} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tag</DialogTitle>
            <DialogDescription>
              {tagToDelete && (tagToDelete.posts_count ?? 0) > 0
                ? `${tagToDelete.posts_count} post(s) use this tag. Deleting it will not delete those posts, but they will lose this tag.`
                : "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteTag.isPending}
              onClick={() => {
                if (tagToDelete) {
                  deleteTag.mutate(tagToDelete.id, { onSuccess: () => setTagToDelete(null) });
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
