"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateCourier } from "@/hooks/use-couriers";
import { PermissionDenied } from "@/components/permission-denied";
import { CourierForm } from "@/components/delivery/courier-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewCourierPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createCourier = useCreateCourier();

  if (currentUser && !can(currentUser, "couriers.create")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add courier</CardTitle>
      </CardHeader>
      <CardContent>
        <CourierForm
          storeId={storeId}
          isPending={createCourier.isPending}
          submitLabel="Create courier"
          serverError={createCourier.error instanceof ApiError ? createCourier.error.message : null}
          onSubmit={(values) =>
            createCourier.mutate(values, {
              onSuccess: () => router.push("/dashboard/delivery/couriers"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
