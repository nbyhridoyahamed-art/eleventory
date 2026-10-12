"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateDeliveryZone } from "@/hooks/use-delivery-zones";
import { PermissionDenied } from "@/components/permission-denied";
import { DeliveryZoneForm } from "@/components/delivery/delivery-zone-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewDeliveryZonePage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createZone = useCreateDeliveryZone();

  if (currentUser && !can(currentUser, "delivery_zones.create")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add delivery zone</CardTitle>
      </CardHeader>
      <CardContent>
        <DeliveryZoneForm
          storeId={storeId}
          isPending={createZone.isPending}
          submitLabel="Create zone"
          serverError={createZone.error instanceof ApiError ? createZone.error.message : null}
          onSubmit={(values) =>
            createZone.mutate(values, {
              onSuccess: () => router.push("/dashboard/delivery/zones"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
