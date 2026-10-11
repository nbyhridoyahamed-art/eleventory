"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";

import {
  useAccountAddresses,
  useCreateAccountAddress,
  useDeleteAccountAddress,
  useUpdateAccountAddress,
} from "@/hooks/use-account";
import { CustomerAddressForm } from "@/components/customers/customer-address-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/storefront/panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";
import type { CustomerAddress } from "@/types/customer";

export default function AccountAddressesPage() {
  const [formAddress, setFormAddress] = useState<CustomerAddress | "new" | null>(null);
  const [addressToDelete, setAddressToDelete] = useState<CustomerAddress | null>(null);

  const { data: addresses, isLoading } = useAccountAddresses();
  const createAddress = useCreateAccountAddress();
  const updateAddress = useUpdateAccountAddress(formAddress && formAddress !== "new" ? formAddress.id : 0);
  const deleteAddress = useDeleteAccountAddress();

  const isEditing = formAddress !== null && formAddress !== "new";
  const activeMutation = isEditing ? updateAddress : createAddress;

  return (
    <Panel
      title="Saved addresses"
      action={
        <button
          type="button"
          onClick={() => setFormAddress("new")}
          className="flex items-center gap-1.5 bg-shop-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-shop-on-accent hover:bg-shop-accent-hover"
        >
          <Plus className="size-3.5" />
          Add address
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-text-muted">Saved shipping addresses for faster checkout.</p>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !addresses || addresses.length === 0 ? (
          <EmptyState
            icon={<MapPin />}
            title="No saved addresses"
            description="Add an address to speed up checkout next time."
          />
        ) : (
          <div className="space-y-2">
            {addresses.map((address) => (
              <div
                key={address.id}
                className="flex items-start justify-between gap-3 border border-border bg-surface p-4"
              >
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{address.recipient_name}</span>
                    {address.label ? <span className="text-text-muted">({address.label})</span> : null}
                    {address.is_default ? <Badge variant="info">Default</Badge> : null}
                  </div>
                  <p className="text-text-secondary">{address.phone}</p>
                  <p className="text-text-secondary">
                    {address.address_line}
                    {address.upazila ? `, ${address.upazila.name_en}` : ""}
                    {address.district ? `, ${address.district.name_en}` : ""}
                    {address.division ? `, ${address.division.name_en}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label="Edit address" onClick={() => setFormAddress(address)}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete address"
                    onClick={() => setAddressToDelete(address)}
                  >
                    <Trash2 className="text-danger" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={formAddress !== null} onOpenChange={(open) => !open && setFormAddress(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isEditing ? "Edit address" : "Add address"}</DialogTitle>
            </DialogHeader>
            <CustomerAddressForm
              defaultValues={isEditing ? formAddress : undefined}
              isPending={activeMutation.isPending}
              submitLabel={isEditing ? "Save changes" : "Add address"}
              serverError={activeMutation.error instanceof ApiError ? activeMutation.error.message : null}
              onSubmit={(values) => activeMutation.mutate(values, { onSuccess: () => setFormAddress(null) })}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(addressToDelete)} onOpenChange={(open) => !open && setAddressToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete address</DialogTitle>
              <DialogDescription>This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddressToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                loading={deleteAddress.isPending}
                onClick={() => {
                  if (addressToDelete) {
                    deleteAddress.mutate(addressToDelete.id, { onSuccess: () => setAddressToDelete(null) });
                  }
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Panel>
  );
}
