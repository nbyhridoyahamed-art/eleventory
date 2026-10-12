"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCurrencies, useStore, useUpdateStore } from "@/hooks/use-stores";
import { PermissionDenied } from "@/components/permission-denied";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

const storeSchema = z.object({
  name: z.string().min(1, "Store name is required."),
  slug: z
    .string()
    .min(1, "Slug is required.")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens."),
  domain: z.string().optional().or(z.literal("")),
  default_currency_id: z.string().optional(),
  default_timezone: z.string().min(1, "Timezone is required."),
  default_locale: z.enum(["en", "bn"]),
  status: z.enum(["active", "inactive"]),
});

type StoreFormValues = z.infer<typeof storeSchema>;

const LOCALE_LABELS: Record<string, string> = { en: "English", bn: "বাংলা (Bangla)" };
const STATUS_LABELS: Record<string, string> = { active: "Active", inactive: "Inactive" };

export default function GeneralSettingsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data: store, isLoading, isError } = useStore(storeId);
  const { data: currencies } = useCurrencies();
  const updateStore = useUpdateStore(storeId ?? 0);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    // Every field the Select components drive must exist in RHF's field
    // map from mount, or a later reset() won't reliably notify useWatch
    // for those (non-native, never register()ed) fields — the native
    // <input> fields don't have this problem since register() itself
    // creates the tracking.
    defaultValues: {
      name: "",
      slug: "",
      domain: "",
      default_currency_id: "",
      default_timezone: "",
      default_locale: "en",
      status: "active",
    },
  });

  const currencyId = useWatch({ control, name: "default_currency_id" });
  const locale = useWatch({ control, name: "default_locale" });
  const status = useWatch({ control, name: "status" });
  const selectedCurrency = (currencies ?? []).find((c) => String(c.id) === currencyId);

  useEffect(() => {
    if (store) {
      reset({
        name: store.name,
        slug: store.slug,
        domain: store.domain ?? "",
        default_currency_id: store.currency ? String(store.currency.id) : "",
        default_timezone: store.default_timezone,
        default_locale: store.default_locale as "en" | "bn",
        status: store.status,
      });
    }
  }, [store, reset]);

  if (currentUser && !can(currentUser, "settings.manage")) {
    return <PermissionDenied />;
  }

  if (isLoading || !currentUser) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (isError || !store) {
    return (
      <Alert variant="danger">
        <AlertDescription>Could not load store settings. Please try again.</AlertDescription>
      </Alert>
    );
  }

  const onSubmit = (values: StoreFormValues) => {
    updateStore.mutate({
      organization_id: store.organization_id,
      name: values.name,
      slug: values.slug,
      domain: values.domain || null,
      default_currency_id: values.default_currency_id ? Number(values.default_currency_id) : null,
      default_timezone: values.default_timezone,
      default_locale: values.default_locale,
      status: values.status,
    });
  };

  const serverError = updateStore.error instanceof ApiError ? updateStore.error.message : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Store details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError ? (
            <Alert variant="danger">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="name">Store name</Label>
            <Input id="name" error={Boolean(errors.name)} {...register("name")} />
            {errors.name ? <p className="text-xs text-danger">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" error={Boolean(errors.slug)} {...register("slug")} />
            {errors.slug ? <p className="text-xs text-danger">{errors.slug.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="domain">Custom domain</Label>
            <Input id="domain" placeholder="shop.example.com" {...register("domain")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="settings-general-currency">Currency</Label>
              <Select
                value={currencyId}
                onValueChange={(value) => value && setValue("default_currency_id", value, { shouldDirty: true })}
              >
                <SelectTrigger id="settings-general-currency">
                  <SelectValue placeholder="Select currency">
                    {selectedCurrency ? `${selectedCurrency.code} (${selectedCurrency.symbol})` : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(currencies ?? []).map((currency) => (
                    <SelectItem key={currency.id} value={String(currency.id)}>
                      {currency.code} ({currency.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-general-language">Language</Label>
              <Select
                value={locale}
                onValueChange={(value) => setValue("default_locale", value as "en" | "bn", { shouldDirty: true })}
              >
                <SelectTrigger id="settings-general-language">
                  <SelectValue placeholder="Select language">{locale ? LOCALE_LABELS[locale] : undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="bn">বাংলা (Bangla)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="default_timezone">Timezone</Label>
              <Input id="default_timezone" {...register("default_timezone")} />
              {errors.default_timezone ? (
                <p className="text-xs text-danger">{errors.default_timezone.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-general-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setValue("status", value as "active" | "inactive", { shouldDirty: true })}
              >
                <SelectTrigger id="settings-general-status">
                  <SelectValue placeholder="Select status">{status ? STATUS_LABELS[status] : undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={updateStore.isPending} disabled={!isDirty}>
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
