"use client";

import { use } from "react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { useAllBrands } from "@/hooks/use-brands";
import { useProduct, useUpdateProduct } from "@/hooks/use-products";
import { PermissionDenied } from "@/components/permission-denied";
import { ProductForm } from "@/components/settings/product-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditProductPage({ params }: PageProps<"/dashboard/catalog/products/[id]">) {
  const { id } = use(params);
  const productId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data: categories } = useCategories(storeId);
  const { data: brandsData } = useAllBrands(storeId);
  const { data: product, isLoading, isError } = useProduct(productId);
  const updateProduct = useUpdateProduct(productId);

  if (currentUser && !can(currentUser, "products.update")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (isError || !product) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this product. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Edit {product.name}</h1>
        <p className="text-sm text-text-secondary">SKU {product.sku}</p>
      </div>

      <ProductForm
        key={product.updated_at ?? product.id}
        storeId={storeId}
        productId={productId}
        categories={categories ?? []}
        brands={brandsData?.data ?? []}
        defaultValues={product}
        isPending={updateProduct.isPending}
        submitLabel="Save changes"
        serverError={updateProduct.error instanceof ApiError ? updateProduct.error.message : null}
        onSubmit={(values) => updateProduct.mutate(values)}
      />
    </div>
  );
}
