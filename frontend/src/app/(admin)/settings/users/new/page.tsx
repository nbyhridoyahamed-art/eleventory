"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateUser } from "@/hooks/use-users";
import { PermissionDenied } from "@/components/permission-denied";
import { UserForm } from "@/components/settings/user-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewUserPage() {
  const { data: currentUser } = useCurrentUser();
  const router = useRouter();
  const createUser = useCreateUser();

  if (currentUser && !can(currentUser, "users.create")) {
    return <PermissionDenied />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add user</CardTitle>
      </CardHeader>
      <CardContent>
        <UserForm
          mode="create"
          isPending={createUser.isPending}
          submitLabel="Create user"
          serverError={createUser.error instanceof ApiError ? createUser.error.message : null}
          onSubmit={(values) =>
            createUser.mutate(values, {
              onSuccess: () => router.push("/settings/users"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
