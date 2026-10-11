"use client";

import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { RichTextEditor } from "@/components/builder/rich-text-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SeoFields, seoFieldsToPayload, seoToFieldsValue } from "@/components/shared/seo-fields";
import { useBlogCategories } from "@/hooks/use-blog-categories";
import { useBlogTags } from "@/hooks/use-blog-tags";
import { slugify } from "@/lib/slugify";
import type { BlogPostFormValues } from "@/hooks/use-blog-posts";
import type { BlogPost, BlogPostStatus } from "@/types/blog-post";

const schema = z.object({
  title: z.string().min(1, "Title is required."),
  slug: z
    .string()
    .min(1, "Slug is required.")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens."),
  excerpt: z.string(),
  body: z.string(),
  featured_image_url: z.string(),
  blog_category_id: z.string(),
  status: z.enum(["draft", "published"]),
  published_at: z.string(),
});

type FormValues = z.infer<typeof schema>;

const STATUS_LABELS: Record<BlogPostStatus, string> = { draft: "Draft", published: "Published" };

interface BlogPostFormProps {
  storeId: number;
  defaultValues?: BlogPost;
  onSubmit: (values: BlogPostFormValues) => void;
  isPending: boolean;
  serverError?: string | null;
  submitLabel: string;
}

function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function BlogPostForm({
  storeId,
  defaultValues,
  onSubmit,
  isPending,
  serverError,
  submitLabel,
}: BlogPostFormProps) {
  const { data: categories } = useBlogCategories(storeId);
  const { data: tags } = useBlogTags(storeId);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(defaultValues?.tags.map((tag) => tag.id) ?? []);
  const [seo, setSeo] = useState(() => seoToFieldsValue(defaultValues?.seo));

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: defaultValues?.title ?? "",
      slug: defaultValues?.slug ?? "",
      excerpt: defaultValues?.excerpt ?? "",
      body: defaultValues?.body ?? "",
      featured_image_url: defaultValues?.featured_image_url ?? "",
      blog_category_id: defaultValues?.blog_category_id ? String(defaultValues.blog_category_id) : "",
      status: defaultValues?.status ?? "draft",
      published_at: toDatetimeLocal(defaultValues?.published_at ?? null),
    },
  });

  const status = useWatch({ control, name: "status" });
  const body = useWatch({ control, name: "body" });
  const categoryId = useWatch({ control, name: "blog_category_id" });
  const watchedTitle = useWatch({ control, name: "title" });
  const watchedSlug = useWatch({ control, name: "slug" });
  const watchedExcerpt = useWatch({ control, name: "excerpt" });

  const slugTouched = useRef(Boolean(defaultValues?.slug));
  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!slugTouched.current) {
      setValue("slug", slugify(event.target.value), { shouldValidate: true });
    }
  };
  const titleField = register("title");
  const slugField = register("slug");

  const toggleTag = (id: number) => {
    setSelectedTagIds((current) => (current.includes(id) ? current.filter((tagId) => tagId !== id) : [...current, id]));
  };

  const submit = handleSubmit((values) => {
    onSubmit({
      store_id: storeId,
      title: values.title,
      slug: values.slug,
      excerpt: values.excerpt || null,
      body: values.body || null,
      featured_image_url: values.featured_image_url || null,
      blog_category_id: values.blog_category_id ? Number(values.blog_category_id) : null,
      tag_ids: selectedTagIds,
      status: values.status,
      published_at: values.published_at ? new Date(values.published_at).toISOString() : null,
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="blog-post-category">Category</Label>
          <Select
            value={categoryId || "none"}
            onValueChange={(value) => setValue("blog_category_id", value === "none" ? "" : value, { shouldDirty: true })}
          >
            <SelectTrigger id="blog-post-category">
              <SelectValue placeholder="No category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {(categories ?? []).map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="featured_image_url">Featured image URL</Label>
          <Input id="featured_image_url" placeholder="https://..." {...register("featured_image_url")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-3 rounded-md border border-border p-3">
          {(tags ?? []).length === 0 ? <p className="text-sm text-text-muted">No tags yet.</p> : null}
          {(tags ?? []).map((tag) => (
            <label key={tag.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <Checkbox checked={selectedTagIds.includes(tag.id)} onCheckedChange={() => toggleTag(tag.id)} />
              {tag.name}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="excerpt">Excerpt</Label>
        <Textarea id="excerpt" rows={2} {...register("excerpt")} />
        <p className="text-xs text-text-muted">
          Optional — shown on listing pages. Left blank, it&apos;s generated automatically from the body.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Body</Label>
        <RichTextEditor
          value={body}
          onChange={(html) => setValue("body", html, { shouldDirty: true })}
          placeholder="Write your post..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="blog-post-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setValue("status", value as BlogPostStatus, { shouldDirty: true })}
          >
            <SelectTrigger id="blog-post-status">
              <SelectValue placeholder="Select status">{status ? STATUS_LABELS[status] : undefined}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="published_at">Publish date</Label>
          <Input id="published_at" type="datetime-local" {...register("published_at")} />
          <p className="text-xs text-text-muted">Leave blank to publish immediately. Set a future date to schedule.</p>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-text-primary">SEO (optional)</p>
        <SeoFields
          value={seo}
          onChange={setSeo}
          titlePlaceholder={watchedTitle || defaultValues?.title}
          descriptionPlaceholder={watchedExcerpt || defaultValues?.excerpt || undefined}
          analysis={{ kind: "post", slug: watchedSlug, content: body, entityId: defaultValues?.id }}
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
