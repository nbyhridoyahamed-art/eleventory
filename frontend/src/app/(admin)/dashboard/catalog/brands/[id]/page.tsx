"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useBrand, useUpdateBrand } from "@/hooks/use-brands";
import { PermissionDenied } from "@/components/permission-denied";
import { BrandForm } from "@/components/settings/brand-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditBrandPage({ params }: PageProps<"/dashboard/catalog/brands/[id]">) {
  const { id } = use(params);
  const brandId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: brand, isLoading, isError } = useBrand(brandId);
  const updateBrand = useUpdateBrand(brandId);

  if (currentUser && !can(currentUser, "brands.update")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !brand) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this brand. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit {brand.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <BrandForm
          storeId={storeId}
          defaultValues={brand}
          isPending={updateBrand.isPending}
          submitLabel="Save changes"
          serverError={updateBrand.error instanceof ApiError ? updateBrand.error.message : null}
          onSubmit={(values) =>
            updateBrand.mutate(values, {
              onSuccess: () => router.push("/dashboard/catalog/brands"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
