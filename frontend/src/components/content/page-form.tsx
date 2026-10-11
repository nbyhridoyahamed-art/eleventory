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
import { SeoFields, seoFieldsToPayload, seoToFieldsValue } from "@/components/shared/seo-fields";
import { slugify } from "@/lib/slugify";
import type { PageFormValues } from "@/hooks/use-pages";
import type { Page } from "@/types/page";

const pageSchema = z.object({
  title: z.string().min(1, "Title is required."),
  slug: z
    .string()
    .min(1, "Slug is required.")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens."),
  content: z.string(),
  status: z.enum(["draft", "published"]),
});

type FormValues = z.infer<typeof pageSchema>;

const STATUS_LABELS: Record<string, string> = { draft: "Draft", published: "Published" };

interface PageFormProps {
  storeId: number;
  defaultValues?: Page;
  onSubmit: (values: PageFormValues) => void;
  isPending: boolean;
  serverError?: string | null;
  submitLabel: string;
}

export function PageForm({ storeId, defaultValues, onSubmit, isPending, serverError, submitLabel }: PageFormProps) {
  const [seo, setSeo] = useState(() => seoToFieldsValue(defaultValues?.seo));

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(pageSchema),
    defaultValues: {
      title: defaultValues?.title ?? "",
      slug: defaultValues?.slug ?? "",
      content: defaultValues?.content ?? "",
      status: defaultValues?.status ?? "draft",
    },
  });

  const status = useWatch({ control, name: "status" });
  const watchedTitle = useWatch({ control, name: "title" });
  const watchedSlug = useWatch({ control, name: "slug" });
  const watchedContent = useWatch({ control, name: "content" });

  const slugTouched = useRef(Boolean(defaultValues?.slug));
  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!slugTouched.current) {
      setValue("slug", slugify(event.target.value), { shouldValidate: true });
    }
  };
  const titleField = register("title");
  const slugField = register("slug");

  const submit = handleSubmit((values) => {
    onSubmit({
      store_id: storeId,
      title: values.title,
      slug: values.slug,
      content: values.content || null,
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            error={Boolean(errors.title)}
            {...titleField}
            onChange={(event) => {
              titleField.onChange(event);
              handleTitleChange(event);
            }}
          />
          {errors.title ? <p className="text-xs text-danger">{errors.title.message}</p> : null}
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
        <Label htmlFor="content">Content</Label>
        <Textarea id="content" rows={12} {...register("content")} />
        <p className="text-xs text-text-muted">Plain text — line breaks are preserved when shown on the storefront.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="page-form-status">Status</Label>
        <Select
          value={status}
          onValueChange={(value) => setValue("status", value as "draft" | "published", { shouldDirty: true })}
        >
          <SelectTrigger id="page-form-status" className="max-w-xs">
            <SelectValue placeholder="Select status">{status ? STATUS_LABELS[status] : undefined}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-text-primary">SEO (optional)</p>
        <SeoFields
          value={seo}
          onChange={setSeo}
          titlePlaceholder={watchedTitle || defaultValues?.title}
          analysis={{ kind: "page", slug: watchedSlug, content: watchedContent, entityId: defaultValues?.id }}
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
