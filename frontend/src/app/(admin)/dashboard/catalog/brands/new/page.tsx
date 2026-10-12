"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateBrand } from "@/hooks/use-brands";
import { PermissionDenied } from "@/components/permission-denied";
import { BrandForm } from "@/components/settings/brand-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewBrandPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createBrand = useCreateBrand();

  if (currentUser && !can(currentUser, "brands.create")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add brand</CardTitle>
      </CardHeader>
      <CardContent>
        <BrandForm
          storeId={storeId}
          isPending={createBrand.isPending}
          submitLabel="Create brand"
          serverError={createBrand.error instanceof ApiError ? createBrand.error.message : null}
          onSubmit={(values) =>
            createBrand.mutate(values, {
              onSuccess: () => router.push("/dashboard/catalog/brands"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
