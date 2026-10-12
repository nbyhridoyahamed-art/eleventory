"use client";

import { use } from "react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCustomer, useUpdateCustomer } from "@/hooks/use-customers";
import { useCustomerStoreCredits } from "@/hooks/use-store-credits";
import { formatMoney } from "@/lib/money";
import { PermissionDenied } from "@/components/permission-denied";
import { CustomerAddressList } from "@/components/customers/customer-address-list";
import { CustomerForm } from "@/components/customers/customer-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

export default function EditCustomerPage({ params }: PageProps<"/orders/customers/[id]">) {
  const { id } = use(params);
  const customerId = Number(id);

  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data: customer, isLoading, isError } = useCustomer(customerId);
  const updateCustomer = useUpdateCustomer(customerId);
  const canViewStoreCredit = can(currentUser, "customers.view");
  const { data: storeCredits } = useCustomerStoreCredits(canViewStoreCredit ? customerId : null);

  if (currentUser && !can(currentUser, "customers.update")) {
    return <PermissionDenied />;
  }

  if (isLoading || !storeId) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError || !customer) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load this customer. It may have been deleted.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Edit {customer.name}</CardTitle>
          <Badge variant={customer.has_account ? "info" : "neutral"}>
            {customer.has_account ? "Account claimed" : "Guest (no account)"}
          </Badge>
        </CardHeader>
        <CardContent>
          <CustomerForm
            storeId={storeId}
            defaultValues={customer}
            isPending={updateCustomer.isPending}
            submitLabel="Save changes"
            serverError={updateCustomer.error instanceof ApiError ? updateCustomer.error.message : null}
            onSubmit={(values) => updateCustomer.mutate(values)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Addresses</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerAddressList
            customerId={customer.id}
            addresses={customer.addresses ?? []}
            canManage={can(currentUser, "customers.update")}
          />
        </CardContent>
      </Card>

      {canViewStoreCredit ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Store credit</CardTitle>
            <span className="text-lg font-semibold text-text-primary">
              {formatMoney(storeCredits?.meta?.balance ?? customer.store_credit_balance ?? 0, "BDT")}
            </span>
          </CardHeader>
          <CardContent>
            {storeCredits?.data.length ? (
              <ul className="space-y-2 text-sm">
                {storeCredits.data.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="text-text-primary">{entry.note ?? (entry.type === "issued" ? "Store credit issued" : "Store credit redeemed")}</p>
                      <p className="text-xs text-text-muted">
                        {new Date(entry.created_at).toLocaleString()}
                        {entry.created_by ? ` · ${entry.created_by}` : ""}
                      </p>
                    </div>
                    <span className={entry.type === "issued" ? "font-medium text-success" : "font-medium text-danger"}>
                      {entry.type === "issued" ? "+" : "-"}
                      {formatMoney(entry.amount, "BDT")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No store credit activity"
                description="Store credit issued from a return refund, or redeemed on an order, will appear here."
              />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
