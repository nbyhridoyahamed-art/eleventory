"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCourier, useUpdateCourier } from "@/hooks/use-couriers";
import { PermissionDenied } from "@/components/permission-denied";
import { CourierForm } from "@/components/delivery/courier-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditCourierPage({ params }: PageProps<"/delivery/couriers/[id]">) {
  const { id } = use(params);
  const courierId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: courier, isLoading, isError } = useCourier(courierId);
  const updateCourier = useUpdateCourier(courierId);

  if (currentUser && !can(currentUser, "couriers.update")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !courier) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this courier. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit {courier.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <CourierForm
          storeId={storeId}
          defaultValues={courier}
          isPending={updateCourier.isPending}
          submitLabel="Save changes"
          serverError={updateCourier.error instanceof ApiError ? updateCourier.error.message : null}
          onSubmit={(values) =>
            updateCourier.mutate(values, {
              onSuccess: () => router.push("/delivery/couriers"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
