"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateCoupon } from "@/hooks/use-coupons";
import { PermissionDenied } from "@/components/permission-denied";
import { CouponForm } from "@/components/orders/coupon-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewCouponPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createCoupon = useCreateCoupon();

  if (currentUser && !can(currentUser, "coupons.create")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add coupon</CardTitle>
      </CardHeader>
      <CardContent>
        <CouponForm
          storeId={storeId}
          isPending={createCoupon.isPending}
          submitLabel="Create coupon"
          serverError={createCoupon.error instanceof ApiError ? createCoupon.error.message : null}
          onSubmit={(values) =>
            createCoupon.mutate(values, {
              onSuccess: () => router.push("/dashboard/orders/coupons"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
