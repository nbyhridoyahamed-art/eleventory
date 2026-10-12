"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useUpdateUser, useUser } from "@/hooks/use-users";
import { PermissionDenied } from "@/components/permission-denied";
import { UserForm } from "@/components/settings/user-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditUserPage({ params }: PageProps<"/dashboard/settings/users/[id]">) {
  const { id } = use(params);
  const userId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const router = useRouter();
  const { data: user, isLoading, isError } = useUser(userId);
  const updateUser = useUpdateUser(userId);

  if (currentUser && !can(currentUser, "users.update") && currentUser.id !== userId) {
    return <PermissionDenied />;
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this user. They may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit {user.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <UserForm
          mode="edit"
          defaultValues={user}
          isPending={updateUser.isPending}
          submitLabel="Save changes"
          serverError={updateUser.error instanceof ApiError ? updateUser.error.message : null}
          onSubmit={(values) =>
            updateUser.mutate(values, {
              onSuccess: () => router.push("/dashboard/settings/users"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
