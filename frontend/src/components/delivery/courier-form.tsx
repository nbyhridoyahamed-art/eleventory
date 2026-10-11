"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTestCourierConnection, type CourierFormValues } from "@/hooks/use-couriers";
import type { Courier } from "@/types/courier";

const courierSchema = z.object({
  name: z.string().min(1, "Name is required."),
  contact_name: z.string(),
  email: z.string().refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address."),
  phone: z.string(),
  tracking_url_template: z.string(),
  status: z.enum(["active", "inactive"]),
  provider: z.enum(["manual", "steadfast"]),
  api_key: z.string(),
  api_secret: z.string(),
});

type FormValues = z.infer<typeof courierSchema>;

const STATUS_LABELS: Record<string, string> = { active: "Active", inactive: "Inactive" };

interface CourierFormProps {
  storeId: number;
  defaultValues?: Courier;
  onSubmit: (values: CourierFormValues) => void;
  isPending: boolean;
  serverError?: string | null;
  submitLabel: string;
}

export function CourierForm({ storeId, defaultValues, onSubmit, isPending, serverError, submitLabel }: CourierFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(courierSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      contact_name: defaultValues?.contact_name ?? "",
      email: defaultValues?.email ?? "",
      phone: defaultValues?.phone ?? "",
      tracking_url_template: defaultValues?.tracking_url_template ?? "",
      status: defaultValues?.status ?? "active",
      provider: defaultValues?.provider ?? "manual",
      api_key: "",
      api_secret: "",
    },
  });

  const status = useWatch({ control, name: "status" });
  const provider = useWatch({ control, name: "provider" });
  const testConnection = useTestCourierConnection(defaultValues?.id ?? 0);
  const hasStoredKeys = Boolean(defaultValues?.has_credentials);

  const submit = handleSubmit((values) => {
    onSubmit({
      store_id: storeId,
      name: values.name,
      contact_name: values.contact_name || null,
      email: values.email || null,
      phone: values.phone || null,
      tracking_url_template: values.tracking_url_template || null,
      status: values.status,
      provider: values.provider,
      api_key: values.provider === "steadfast" ? values.api_key || null : null,
      api_secret: values.provider === "steadfast" ? values.api_secret || null : null,
    });
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      {serverError ? (
        <Alert variant="danger">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Courier name</Label>
          <Input id="name" error={Boolean(errors.name)} {...register("name")} />
          {errors.name ? <p className="text-xs text-danger">{errors.name.message}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact_name">Contact person</Label>
          <Input id="contact_name" {...register("contact_name")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" error={Boolean(errors.email)} {...register("email")} />
          {errors.email ? <p className="text-xs text-danger">{errors.email.message}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register("phone")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tracking_url_template">Tracking URL template (optional)</Label>
        <Input
          id="tracking_url_template"
          placeholder="https://courier.example.com/track/{tracking_number}"
          {...register("tracking_url_template")}
        />
        <p className="text-xs text-text-muted">
          {"{tracking_number}"} is replaced with the shipment&apos;s tracking number.
        </p>
      </div>

      <div className="space-y-3 rounded-md border border-border p-4">
        <div className="max-w-64 space-y-1.5">
          <Label htmlFor="courier-form-provider">Booking method</Label>
          <Select
            value={provider}
            onValueChange={(value) => setValue("provider", value as "manual" | "steadfast", { shouldDirty: true })}
          >
            <SelectTrigger id="courier-form-provider">
              <SelectValue>{provider === "steadfast" ? "Steadfast (API)" : "Manual"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual — type the tracking number</SelectItem>
              <SelectItem value="steadfast">Steadfast (API) — book parcels automatically</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {provider === "steadfast" ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="api_key">API key</Label>
                <Input
                  id="api_key"
                  autoComplete="off"
                  placeholder={hasStoredKeys ? "•••••• saved — leave blank to keep" : ""}
                  {...register("api_key")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="api_secret">Secret key</Label>
                <Input
                  id="api_secret"
                  type="password"
                  autoComplete="new-password"
                  placeholder={hasStoredKeys ? "•••••• saved — leave blank to keep" : ""}
                  {...register("api_secret")}
                />
              </div>
            </div>
            <p className="text-xs text-text-muted">
              Find both in your Steadfast merchant panel under API settings. They are stored encrypted and never shown again.
            </p>
            {defaultValues && hasStoredKeys ? (
              <Button type="button" variant="outline" size="sm" loading={testConnection.isPending} onClick={() => testConnection.mutate()}>
                Test connection
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="max-w-48 space-y-1.5">
        <Label htmlFor="courier-form-status">Status</Label>
        <Select
          value={status}
          onValueChange={(value) => setValue("status", value as "active" | "inactive", { shouldDirty: true })}
        >
          <SelectTrigger id="courier-form-status">
            <SelectValue placeholder="Select status">{status ? STATUS_LABELS[status] : undefined}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
