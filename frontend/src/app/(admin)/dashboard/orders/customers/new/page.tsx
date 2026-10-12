"use client";

import { useRouter } from "next/navigation";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateCustomer } from "@/hooks/use-customers";
import { PermissionDenied } from "@/components/permission-denied";
import { CustomerForm } from "@/components/customers/customer-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/types/api";

export default function NewCustomerPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const router = useRouter();
  const createCustomer = useCreateCustomer();

  if (currentUser && !can(currentUser, "customers.create")) {
    return <PermissionDenied />;
  }

  if (!storeId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add customer</CardTitle>
      </CardHeader>
      <CardContent>
        <CustomerForm
          storeId={storeId}
          isPending={createCustomer.isPending}
          submitLabel="Create customer"
          serverError={createCustomer.error instanceof ApiError ? createCustomer.error.message : null}
          onSubmit={(values) =>
            createCustomer.mutate(values, {
              onSuccess: (customer) => router.push(`/dashboard/orders/customers/${customer.id}`),
            })
          }
        />
      </CardContent>
    </Card>
  );
}
