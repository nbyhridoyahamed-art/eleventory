"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCoupon, useUpdateCoupon } from "@/hooks/use-coupons";
import { PermissionDenied } from "@/components/permission-denied";
import { CouponForm } from "@/components/orders/coupon-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditCouponPage({ params }: PageProps<"/orders/coupons/[id]">) {
  const { id } = use(params);
  const couponId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const { data: coupon, isLoading, isError } = useCoupon(couponId);
  const updateCoupon = useUpdateCoupon(couponId);

  if (currentUser && !can(currentUser, "coupons.update")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !coupon) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this coupon. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Edit {coupon.code}
          {coupon.used_count > 0 ? (
            <span className="ml-2 text-sm font-normal text-text-muted">
              — used {coupon.used_count} time{coupon.used_count === 1 ? "" : "s"}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <CouponForm
          storeId={storeId}
          defaultValues={coupon}
          isPending={updateCoupon.isPending}
          submitLabel="Save changes"
          serverError={updateCoupon.error instanceof ApiError ? updateCoupon.error.message : null}
          onSubmit={(values) =>
            updateCoupon.mutate(values, {
              onSuccess: () => router.push("/orders/coupons"),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
