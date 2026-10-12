"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDeleteRole, useRoles } from "@/hooks/use-roles";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge } from "@/components/ui/badge";
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
import type { Role } from "@/types/role";

const LOCKED_ROLES = ["Super Admin", "Store Owner"];

export default function RolesSettingsPage() {
  const { data: currentUser } = useCurrentUser();
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const { data: roles, isLoading } = useRoles();
  const deleteRole = useDeleteRole();

  if (currentUser && !can(currentUser, "roles.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "roles.create");
  const canDelete = can(currentUser, "roles.delete");

  const columns: DataTableColumn<Role>[] = [
    {
      id: "name",
      header: "Role",
      cell: (role) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{role.name}</span>
          {LOCKED_ROLES.includes(role.name) ? <Badge variant="info">Built-in</Badge> : null}
        </div>
      ),
    },
    {
      id: "permissions",
      header: "Permissions",
      cell: (role) => `${role.permissions.length} granted`,
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (role) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${role.name}`}>
            <Link href={`/dashboard/settings/roles/${role.id}`}>
              <Pencil />
            </Link>
          </Button>
          {canDelete && !LOCKED_ROLES.includes(role.name) ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${role.name}`}
              onClick={() => setRoleToDelete(role)}
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
            <Link href="/dashboard/settings/roles/new">
              <Plus />
              Add role
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={roles ?? []}
        rowKey={(role) => role.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={<ShieldCheck />}
            title="No roles yet"
            description="Create a role to control what your team can do."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/settings/roles/new">Add role</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(roleToDelete)} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete role</DialogTitle>
            <DialogDescription>
              Staff currently assigned {roleToDelete?.name} will lose the permissions it grants.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteRole.isPending}
              onClick={() => {
                if (roleToDelete) {
                  deleteRole.mutate(roleToDelete.id, {
                    onSuccess: () => setRoleToDelete(null),
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
