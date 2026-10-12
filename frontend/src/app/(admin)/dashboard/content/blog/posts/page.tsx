"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useBlogPosts, useDeleteBlogPost } from "@/hooks/use-blog-posts";
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
import type { BlogPost } from "@/types/blog-post";

export default function BlogPostsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null);

  const { data: posts, isLoading } = useBlogPosts(storeId);
  const deletePost = useDeleteBlogPost();

  if (currentUser && !can(currentUser, "blog.manage")) {
    return <PermissionDenied />;
  }

  const columns: DataTableColumn<BlogPost>[] = [
    { id: "title", header: "Title", cell: (post) => <span className="font-medium">{post.title}</span> },
    {
      id: "seo",
      header: "SEO",
      cell: (post) => <SeoScoreBadge seo={post.seo} />,
    },
    { id: "category", header: "Category", cell: (post) => post.category?.name ?? "—" },
    {
      id: "view",
      header: "View",
      cell: (post) => (
        <ViewOnSiteLink
          href={`/blog/${post.slug}`}
          visible={post.status === "published"}
          label={post.title}
          hiddenReason="This post isn't published, so it isn't on the storefront"
        />
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (post) => <Badge variant={post.status === "published" ? "success" : "neutral"}>{post.status}</Badge>,
    },
    {
      id: "published_at",
      header: "Published",
      cell: (post) => (post.published_at ? new Date(post.published_at).toLocaleDateString() : "—"),
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (post) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${post.title}`}>
            <Link href={`/dashboard/content/blog/posts/${post.id}`}>
              <Pencil />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Delete ${post.title}`} onClick={() => setPostToDelete(post)}>
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
          <Link href="/dashboard/content/blog/posts/new">
            <Plus />
            Add post
          </Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={posts ?? []}
        rowKey={(post) => post.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={<FileText />}
            title="No posts yet"
            description="Write your first blog post to share news, guides, and updates with customers."
            action={
              <Button asChild size="sm">
                <Link href="/dashboard/content/blog/posts/new">Add post</Link>
              </Button>
            }
          />
        }
      />

      <Dialog open={Boolean(postToDelete)} onOpenChange={(open) => !open && setPostToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete post</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deletePost.isPending}
              onClick={() => {
                if (postToDelete) {
                  deletePost.mutate(postToDelete.id, { onSuccess: () => setPostToDelete(null) });
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
