"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Pencil, Plus, Trash2 } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDeleteRedirect, useRedirects } from "@/hooks/use-redirects";
import { PermissionDenied } from "@/components/permission-denied";
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
import type { Redirect } from "@/types/redirect";

export default function RedirectsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [redirectToDelete, setRedirectToDelete] = useState<Redirect | null>(null);

  const { data: redirects, isLoading } = useRedirects(storeId);
  const deleteRedirect = useDeleteRedirect();

  if (currentUser && !can(currentUser, "seo.manage")) {
    return <PermissionDenied />;
  }

  const canManage = can(currentUser, "seo.manage");

  const columns: DataTableColumn<Redirect>[] = [
    {
      id: "from_path",
      header: "From",
      cell: (redirect) => <span className="font-medium">{redirect.from_path}</span>,
    },
    { id: "to_path", header: "To", cell: (redirect) => redirect.to_path },
    { id: "status_code", header: "Status code", cell: (redirect) => redirect.status_code },
    { id: "hits_count", header: "Hits", cell: (redirect) => redirect.hits_count },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (redirect) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${redirect.from_path}`}>
            <Link href={`/seo/redirects/${redirect.id}`}>
              <Pencil />
            </Link>
          </Button>
          {canManage ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${redirect.from_path}`}
              onClick={() => setRedirectToDelete(redirect)}
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
        {canManage ? (
          <Button asChild>
            <Link href="/seo/redirects/new">
              <Plus />
              Add redirect
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={redirects ?? []}
        rowKey={(redirect) => redirect.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={<ArrowRightLeft />}
            title="No redirects yet"
            description="Add a redirect to send visitors from an old URL to a new one."
            action={
              canManage ? (
                <Button asChild size="sm">
                  <Link href="/seo/redirects/new">Add redirect</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(redirectToDelete)} onOpenChange={(open) => !open && setRedirectToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete redirect</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedirectToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteRedirect.isPending}
              onClick={() => {
                if (redirectToDelete) {
                  deleteRedirect.mutate(redirectToDelete.id, { onSuccess: () => setRedirectToDelete(null) });
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
