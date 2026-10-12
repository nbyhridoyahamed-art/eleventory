"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDeliveryZone, useUpdateDeliveryZone } from "@/hooks/use-delivery-zones";
import { PermissionDenied } from "@/components/permission-denied";
import { DeliveryZoneForm } from "@/components/delivery/delivery-zone-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditDeliveryZonePage({ params }: PageProps<"/delivery/zones/[id]">) {
  const { id } = use(params);
  const zoneId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: zone, isLoading, isError } = useDeliveryZone(zoneId);
  const updateZone = useUpdateDeliveryZone(zoneId);

  if (currentUser && !can(currentUser, "delivery_zones.update")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !zone) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this delivery zone. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit {zone.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <DeliveryZoneForm
          storeId={storeId}
          defaultValues={zone}
          isPending={updateZone.isPending}
          submitLabel="Save changes"
          serverError={updateZone.error instanceof ApiError ? updateZone.error.message : null}
          onSubmit={(values) =>
            updateZone.mutate(values, {
              onSuccess: () => router.push("/delivery/zones"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
