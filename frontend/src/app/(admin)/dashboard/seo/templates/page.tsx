"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSearch, Pencil, Plus, Trash2 } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDeleteSeoTemplate, useSeoTemplates } from "@/hooks/use-seo-templates";
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
import { ENTITY_TYPE_LABELS, type SeoTemplate } from "@/types/seo-template";

export default function SeoTemplatesPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [templateToDelete, setTemplateToDelete] = useState<SeoTemplate | null>(null);

  const { data: templates, isLoading } = useSeoTemplates(storeId);
  const deleteTemplate = useDeleteSeoTemplate();

  if (currentUser && !can(currentUser, "seo.manage")) {
    return <PermissionDenied />;
  }

  const canManage = can(currentUser, "seo.manage");

  const columns: DataTableColumn<SeoTemplate>[] = [
    {
      id: "entity_type",
      header: "Entity type",
      cell: (template) => (
        <span className="font-medium">{ENTITY_TYPE_LABELS[template.entity_type] ?? template.entity_type}</span>
      ),
    },
    { id: "title_template", header: "Title template", cell: (template) => template.title_template ?? "—" },
    {
      id: "description_template",
      header: "Description template",
      cell: (template) => template.description_template ?? "—",
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (template) => {
        const label = ENTITY_TYPE_LABELS[template.entity_type] ?? template.entity_type;
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" asChild aria-label={`Edit ${label}`}>
              <Link href={`/dashboard/seo/templates/${template.id}`}>
                <Pencil />
              </Link>
            </Button>
            {canManage ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${label}`}
                onClick={() => setTemplateToDelete(template)}
              >
                <Trash2 className="text-danger" />
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canManage ? (
          <Button asChild>
            <Link href="/dashboard/seo/templates/new">
              <Plus />
              Add template
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={templates ?? []}
        rowKey={(template) => template.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={<FileSearch />}
            title="No SEO templates yet"
            description="Add a template to control how titles and descriptions are generated for a type of content."
            action={
              canManage ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/seo/templates/new">Add template</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(templateToDelete)} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete SEO template</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteTemplate.isPending}
              onClick={() => {
                if (templateToDelete) {
                  deleteTemplate.mutate(templateToDelete.id, { onSuccess: () => setTemplateToDelete(null) });
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
