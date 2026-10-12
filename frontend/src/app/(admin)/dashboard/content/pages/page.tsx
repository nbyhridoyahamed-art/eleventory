"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDeletePage, usePages } from "@/hooks/use-pages";
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
import type { Page } from "@/types/page";

export default function PagesPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [pageToDelete, setPageToDelete] = useState<Page | null>(null);

  const { data: pages, isLoading } = usePages(storeId);
  const deletePage = useDeletePage();

  if (currentUser && !can(currentUser, "pages.manage")) {
    return <PermissionDenied />;
  }

  const canManage = can(currentUser, "pages.manage");

  const columns: DataTableColumn<Page>[] = [
    { id: "title", header: "Title", cell: (page) => <span className="font-medium">{page.title}</span> },
    {
      id: "seo",
      header: "SEO",
      cell: (page) => <SeoScoreBadge seo={page.seo} />,
    },
    { id: "slug", header: "Slug", cell: (page) => `/pages/${page.slug}` },
    {
      id: "view",
      header: "View",
      cell: (page) => (
        <ViewOnSiteLink
          href={`/pages/${page.slug}`}
          visible={page.status === "published"}
          label={page.title}
          hiddenReason="This page is a draft, so it isn't on the storefront"
        />
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (page) => <Badge variant={page.status === "published" ? "success" : "neutral"}>{page.status}</Badge>,
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (page) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${page.title}`}>
            <Link href={`/dashboard/content/pages/${page.id}`}>
              <Pencil />
            </Link>
          </Button>
          {canManage ? (
            <Button variant="ghost" size="icon" aria-label={`Delete ${page.title}`} onClick={() => setPageToDelete(page)}>
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
        {canManage ? (
          <Button asChild>
            <Link href="/dashboard/content/pages/new">
              <Plus />
              Add page
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={pages ?? []}
        rowKey={(page) => page.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={<FileText />}
            title="No pages yet"
            description="Add content pages like About Us, Terms & Conditions, or Privacy Policy for your storefront."
            action={
              canManage ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/content/pages/new">Add page</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(pageToDelete)} onOpenChange={(open) => !open && setPageToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete page</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPageToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deletePage.isPending}
              onClick={() => {
                if (pageToDelete) {
                  deletePage.mutate(pageToDelete.id, { onSuccess: () => setPageToDelete(null) });
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
