"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useRoles, useUpdateRole } from "@/hooks/use-roles";
import { PermissionDenied } from "@/components/permission-denied";
import { RoleForm } from "@/components/settings/role-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

const LOCKED_ROLES = ["Super Admin", "Store Owner"];

export default function EditRolePage({ params }: PageProps<"/dashboard/settings/roles/[id]">) {
  const { id } = use(params);
  const roleId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const router = useRouter();
  const { data: roles, isLoading } = useRoles();
  const updateRole = useUpdateRole(roleId);

  if (currentUser && !can(currentUser, "roles.update")) {
    return <PermissionDenied />;
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const role = roles?.find((r) => r.id === roleId);

  if (!role) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not find this role. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  const locked = LOCKED_ROLES.includes(role.name);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit {role.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <RoleForm
          defaultValues={role}
          locked={locked}
          isPending={updateRole.isPending}
          submitLabel="Save changes"
          serverError={updateRole.error instanceof ApiError ? updateRole.error.message : null}
          onSubmit={(values) =>
            updateRole.mutate(values, {
              onSuccess: () => router.push("/dashboard/settings/roles"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
