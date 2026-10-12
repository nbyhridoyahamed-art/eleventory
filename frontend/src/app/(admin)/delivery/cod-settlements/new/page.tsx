"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateCodSettlement } from "@/hooks/use-cod-settlements";
import { PermissionDenied } from "@/components/permission-denied";
import { CodSettlementForm } from "@/components/delivery/cod-settlement-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewCodSettlementPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createSettlement = useCreateCodSettlement();

  if (currentUser && !can(currentUser, "cod_settlements.create")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record COD settlement</CardTitle>
      </CardHeader>
      <CardContent>
        <CodSettlementForm
          storeId={storeId}
          isPending={createSettlement.isPending}
          serverError={createSettlement.error instanceof ApiError ? createSettlement.error.message : null}
          onSubmit={(values) =>
            createSettlement.mutate(values, {
              onSuccess: (settlement) => router.push(`/delivery/cod-settlements/${settlement.id}`),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
