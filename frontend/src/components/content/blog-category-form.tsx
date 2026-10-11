"use client";

import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SeoFields, seoFieldsToPayload, seoToFieldsValue } from "@/components/shared/seo-fields";
import { slugify } from "@/lib/slugify";
import type { BlogCategoryFormValues } from "@/hooks/use-blog-categories";
import type { BlogCategory } from "@/types/blog-category";

const schema = z.object({
  name: z.string().min(1, "Name is required."),
  slug: z
    .string()
    .min(1, "Slug is required.")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens."),
  description: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface BlogCategoryFormProps {
  storeId: number;
  defaultValues?: BlogCategory;
  onSubmit: (values: BlogCategoryFormValues) => void;
  isPending: boolean;
  serverError?: string | null;
  submitLabel: string;
}

export function BlogCategoryForm({
  storeId,
  defaultValues,
  onSubmit,
  isPending,
  serverError,
  submitLabel,
}: BlogCategoryFormProps) {
  const [seo, setSeo] = useState(() => seoToFieldsValue(defaultValues?.seo));

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      slug: defaultValues?.slug ?? "",
      description: defaultValues?.description ?? "",
    },
  });

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
      description: values.description || null,
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

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...register("description")} />
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <p className="text-sm font-medium text-text-primary">SEO</p>
        <SeoFields
          value={seo}
          onChange={setSeo}
          titlePlaceholder={watch("name") || defaultValues?.name}
          descriptionPlaceholder={watch("description") || defaultValues?.description || undefined}
          analysis={{ kind: "blog_category", slug: watch("slug"), content: watch("description"), entityId: defaultValues?.id }}
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
