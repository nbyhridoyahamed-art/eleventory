"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAttributes, useDeleteAttribute } from "@/hooks/use-attributes";
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
import type { ProductAttribute } from "@/types/attribute";

export default function AttributesPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [attributeToDelete, setAttributeToDelete] = useState<ProductAttribute | null>(null);

  const { data: attributes, isLoading } = useAttributes(storeId);
  const deleteAttribute = useDeleteAttribute();

  if (currentUser && !can(currentUser, "attributes.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "attributes.create");
  const canDelete = can(currentUser, "attributes.delete");

  const columns: DataTableColumn<ProductAttribute>[] = [
    { id: "name", header: "Name", cell: (attribute) => <span className="font-medium">{attribute.name}</span> },
    { id: "slug", header: "Slug", cell: (attribute) => attribute.slug },
    {
      id: "values",
      header: "Values",
      cell: (attribute) =>
        attribute.values.length > 0 ? attribute.values.map((v) => v.value).join(", ") : "—",
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (attribute) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${attribute.name}`}>
            <Link href={`/dashboard/catalog/attributes/${attribute.id}`}>
              <Pencil />
            </Link>
          </Button>
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${attribute.name}`}
              onClick={() => setAttributeToDelete(attribute)}
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
            <Link href="/dashboard/catalog/attributes/new">
              <Plus />
              Add attribute
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={attributes ?? []}
        rowKey={(attribute) => attribute.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={<Tag />}
            title="No attributes yet"
            description="Attributes like Color or Size let you build variable products with a generated set of variants."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/catalog/attributes/new">Add attribute</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(attributeToDelete)} onOpenChange={(open) => !open && setAttributeToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete attribute</DialogTitle>
            <DialogDescription>
              This can&apos;t be undone. If any value is still used by a product variant, deletion will be
              blocked until it&apos;s removed from every variant.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttributeToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteAttribute.isPending}
              onClick={() => {
                if (attributeToDelete) {
                  deleteAttribute.mutate(attributeToDelete.id, { onSuccess: () => setAttributeToDelete(null) });
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
