"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2, UserCog, Users as UsersIcon } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDeleteUser, useUsers } from "@/hooks/use-users";
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
import { Input } from "@/components/ui/input";
import type { User } from "@/types/auth";

export default function UsersSettingsPage() {
  const { data: currentUser } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { data, isLoading } = useUsers(page, search);
  const deleteUser = useDeleteUser();

  if (currentUser && !can(currentUser, "users.view")) {
    return <PermissionDenied />;
  }

  const canCreate = can(currentUser, "users.create");
  const canDelete = can(currentUser, "users.delete");

  const columns: DataTableColumn<User>[] = [
    {
      id: "name",
      header: "Name",
      cell: (user) => (
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-xs text-text-muted">{user.email}</p>
        </div>
      ),
    },
    { id: "phone", header: "Phone", cell: (user) => user.phone ?? "—" },
    {
      id: "roles",
      header: "Roles",
      cell: (user) =>
        user.roles.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {user.roles.map((role) => (
              <Badge key={role} variant="primary">
                {role}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-text-muted">No role</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: (user) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={user.status === "active" ? "success" : "warning"}>{user.status}</Badge>
          {user.email_verified === false ? <Badge variant="warning">Unverified</Badge> : null}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (user) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${user.name}`}>
            <Link href={`/dashboard/settings/users/${user.id}`}>
              <UserCog />
            </Link>
          </Button>
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${user.name}`}
              disabled={user.id === currentUser?.id}
              onClick={() => setUserToDelete(user)}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/settings/users/new">
              <Plus />
              Add user
            </Link>
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(user) => user.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={<UsersIcon />}
            title="No staff users yet"
            description="Invite your team so they can help manage the store."
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/settings/users/new">Add user</Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <Dialog open={Boolean(userToDelete)} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              This will permanently remove {userToDelete?.name}&apos;s access to the admin. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteUser.isPending}
              onClick={() => {
                if (userToDelete) {
                  deleteUser.mutate(userToDelete.id, {
                    onSuccess: () => setUserToDelete(null),
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
