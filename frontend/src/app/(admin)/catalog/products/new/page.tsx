"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCategories } from "@/hooks/use-categories";
import { useAllBrands } from "@/hooks/use-brands";
import { useCreateProduct } from "@/hooks/use-products";
import { PermissionDenied } from "@/components/permission-denied";
import { ProductForm } from "@/components/settings/product-form";
import { ApiError } from "@/types/api";

export default function NewProductPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: categories } = useCategories(storeId);
  const { data: brandsData } = useAllBrands(storeId);
  const createProduct = useCreateProduct();
  const [uploading, setUploading] = useState(false);

  if (currentUser && !can(currentUser, "products.create")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Add product</h1>
        <p className="text-sm text-text-secondary">Everything for the product is on this page — scroll down for pricing, images and SEO.</p>
      </div>

      <ProductForm
        storeId={storeId}
        categories={categories ?? []}
        brands={brandsData?.data ?? []}
        isPending={createProduct.isPending || uploading}
        submitLabel="Create product"
        serverError={createProduct.error instanceof ApiError ? createProduct.error.message : null}
        onSubmit={(values, files) =>
          createProduct.mutate(values, {
            onSuccess: async (product) => {
              if (files.length > 0) {
                setUploading(true);
                let failed = 0;

                // One at a time, in the order chosen, so the first image becomes the primary one.
                for (const file of files) {
                  try {
                    const formData = new FormData();
                    formData.append("image", file);
                    await api.post(`/products/${product.id}/images`, formData);
                  } catch {
                    failed++;
                  }
                }

                setUploading(false);
                queryClient.invalidateQueries({ queryKey: ["products"] });

                if (failed > 0) {
                  toast.error(`${failed} image${failed === 1 ? "" : "s"} could not be uploaded. Add them from the product page.`);
                }
              }

              router.push(`/catalog/products/${product.id}`);
            },
          })
        }
      />
    </div>
  );
}
