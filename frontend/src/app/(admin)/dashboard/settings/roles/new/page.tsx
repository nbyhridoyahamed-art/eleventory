"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateRole } from "@/hooks/use-roles";
import { PermissionDenied } from "@/components/permission-denied";
import { RoleForm } from "@/components/settings/role-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewRolePage() {
  const { data: currentUser } = useCurrentUser();
  const router = useRouter();
  const createRole = useCreateRole();

  if (currentUser && !can(currentUser, "roles.create")) {
    return <PermissionDenied />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add role</CardTitle>
      </CardHeader>
      <CardContent>
        <RoleForm
          isPending={createRole.isPending}
          submitLabel="Create role"
          serverError={createRole.error instanceof ApiError ? createRole.error.message : null}
          onSubmit={(values) =>
            createRole.mutate(values, {
              onSuccess: () => router.push("/dashboard/settings/roles"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
