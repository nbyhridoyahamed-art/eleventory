"use client";

import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/settings/image-upload-field";
import { SeoFields, seoFieldsToPayload, seoToFieldsValue } from "@/components/shared/seo-fields";
import { slugify } from "@/lib/slugify";
import type { CategoryFormValues } from "@/hooks/use-categories";
import type { Category } from "@/types/category";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required."),
  slug: z
    .string()
    .min(1, "Slug is required.")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens."),
  parent_id: z.string(),
  description: z.string(),
  image_path: z.string(),
  status: z.enum(["active", "inactive"]),
});

type FormValues = z.infer<typeof categorySchema>;

const STATUS_LABELS: Record<string, string> = { active: "Active", inactive: "Inactive" };

interface CategoryFormProps {
  storeId: number;
  parentOptions: Category[];
  defaultValues?: Category;
  onSubmit: (values: CategoryFormValues) => void;
  isPending: boolean;
  serverError?: string | null;
  submitLabel: string;
}

export function CategoryForm({
  storeId,
  parentOptions,
  defaultValues,
  onSubmit,
  isPending,
  serverError,
  submitLabel,
}: CategoryFormProps) {
  const [seo, setSeo] = useState(() => seoToFieldsValue(defaultValues?.seo));

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      slug: defaultValues?.slug ?? "",
      parent_id: defaultValues?.parent_id ? String(defaultValues.parent_id) : "",
      description: defaultValues?.description ?? "",
      image_path: defaultValues?.image_path ?? "",
      status: defaultValues?.status ?? "active",
    },
  });

  const parentId = useWatch({ control, name: "parent_id" });
  const status = useWatch({ control, name: "status" });
  const watchedName = useWatch({ control, name: "name" });
  const watchedSlug = useWatch({ control, name: "slug" });
  const watchedDescription = useWatch({ control, name: "description" });
  const selectedParent = parentOptions.find((c) => String(c.id) === parentId);

  const slugTouched = useRef(Boolean(defaultValues?.slug));
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!slugTouched.current) {
      setValue("slug", slugify(event.target.value), { shouldValidate: true });
    }
  };
  const nameField = register("name");
  const slugField = register("slug");

  const submit = handleSubmit((values) => {
    onSubmit({
      store_id: storeId,
      name: values.name,
      slug: values.slug,
      parent_id: values.parent_id ? Number(values.parent_id) : null,
      description: values.description || null,
      image_path: values.image_path || null,
      status: values.status,
      seo: seoFieldsToPayload(seo),
    });
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      {serverError ? (
        <Alert variant="danger">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <ImageUploadField
        label="Category image"
        folder="categories"
        imageUrl={defaultValues?.image_url ?? null}
        onUploaded={(path) => setValue("image_path", path, { shouldDirty: true })}
        onRemove={() => setValue("image_path", "", { shouldDirty: true })}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            error={Boolean(errors.name)}
            {...nameField}
            onChange={(event) => {
              nameField.onChange(event);
              handleNameChange(event);
            }}
          />
          {errors.name ? <p className="text-xs text-danger">{errors.name.message}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            error={Boolean(errors.slug)}
            {...slugField}
            onChange={(event) => {
              slugTouched.current = true;
              slugField.onChange(event);
            }}
          />
          {errors.slug ? <p className="text-xs text-danger">{errors.slug.message}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="category-parent">Parent category</Label>
          <Select
            value={parentId}
            onValueChange={(value) => setValue("parent_id", value === "none" ? "" : value, { shouldDirty: true })}
          >
            <SelectTrigger id="category-parent">
              <SelectValue placeholder="None (top-level)">
                {parentId ? (selectedParent?.name ?? undefined) : "None (top-level)"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (top-level)</SelectItem>
              {parentOptions
                .filter((c) => c.id !== defaultValues?.id)
                .map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setValue("status", value as "active" | "inactive", { shouldDirty: true })}
          >
            <SelectTrigger id="category-status">
              <SelectValue placeholder="Select status">{status ? STATUS_LABELS[status] : undefined}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" {...register("description")} />
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <p className="text-sm font-medium text-text-primary">SEO</p>
        <SeoFields
          value={seo}
          onChange={setSeo}
          titlePlaceholder={watchedName || defaultValues?.name}
          descriptionPlaceholder={watchedDescription || defaultValues?.description || undefined}
          analysis={{ kind: "category", slug: watchedSlug, content: watchedDescription, entityId: defaultValues?.id }}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
