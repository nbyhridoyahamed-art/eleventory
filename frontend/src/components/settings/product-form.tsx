"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Sparkles, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { api } from "@/lib/api";
import { slugify } from "@/lib/slugify";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/builder/rich-text-editor";
import { SeoFields, seoFieldsToPayload, seoToFieldsValue } from "@/components/shared/seo-fields";
import { ProductImageGallery } from "@/components/settings/product-image-gallery";
import { ComponentsManager } from "@/components/catalog/components-manager";
import { VariantsManager } from "@/components/catalog/variants-manager";
import type { ProductFormValues } from "@/hooks/use-products";
import type { Brand } from "@/types/brand";
import type { Category } from "@/types/category";
import type { Product } from "@/types/product";

const moneyField = z
  .string()
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount, e.g. 199.99");

const productSchema = z
  .object({
    category_id: z.string(),
    brand_id: z.string(),
    type: z.enum(["simple", "variable", "bundle"]),
    name: z.string().min(1, "Name is required."),
    slug: z
      .string()
      .min(1, "Slug is required.")
      .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens."),
    sku: z.string(),
    barcode: z.string(),
    description: z.string(),
    short_description: z.string(),
    price: moneyField.refine((v) => v !== "", "Price is required."),
    sale_price: moneyField,
    cost_price: moneyField,
    compare_at_price: moneyField,
    weight: z.string(),
    weight_unit: z.string(),
    track_stock: z.boolean(),
    low_stock_threshold: z.string(),
    status: z.enum(["draft", "active", "archived"]),
    featured: z.boolean(),
  })
  .refine((data) => data.sale_price === "" || Number(data.sale_price) < Number(data.price), {
    message: "Sale price must be lower than the regular price.",
    path: ["sale_price"],
  });

type FormValues = z.infer<typeof productSchema>;

const STATUS_LABELS: Record<string, string> = { draft: "Draft", active: "Active (published)", archived: "Archived" };
const WEIGHT_UNIT_LABELS: Record<string, string> = { kg: "kg", g: "g", lb: "lb" };
const TYPE_LABELS: Record<string, string> = {
  simple: "Simple",
  variable: "Variable (has variants)",
  bundle: "Bundle (combo of other products)",
};

interface ProductFormProps {
  storeId: number;
  categories: Category[];
  brands: Brand[];
  defaultValues?: Product;
  productId?: number;
  /** `files` are images chosen before the product existed; the caller uploads them once it is created. */
  onSubmit: (values: ProductFormValues, files: File[]) => void;
  isPending: boolean;
  serverError?: string | null;
  submitLabel: string;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {description ? <p className="text-xs text-text-muted">{description}</p> : null}
      </header>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

export function ProductForm({
  storeId,
  categories,
  brands,
  defaultValues,
  productId,
  onSubmit,
  isPending,
  serverError,
  submitLabel,
}: ProductFormProps) {
  const [seo, setSeo] = useState(() => seoToFieldsValue(defaultValues?.seo));
  const [files, setFiles] = useState<File[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [skuLoading, setSkuLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      category_id: defaultValues?.category_id ? String(defaultValues.category_id) : "",
      brand_id: defaultValues?.brand_id ? String(defaultValues.brand_id) : "",
      type: defaultValues?.type === "variable" || defaultValues?.type === "bundle" ? defaultValues.type : "simple",
      name: defaultValues?.name ?? "",
      slug: defaultValues?.slug ?? "",
      sku: defaultValues?.sku ?? "",
      barcode: defaultValues?.barcode ?? "",
      description: defaultValues?.description ?? "",
      short_description: defaultValues?.short_description ?? "",
      price: defaultValues?.price !== undefined ? String(defaultValues.price) : "",
      sale_price: defaultValues?.sale_price !== null && defaultValues?.sale_price !== undefined ? String(defaultValues.sale_price) : "",
      cost_price: defaultValues?.cost_price !== null && defaultValues?.cost_price !== undefined ? String(defaultValues.cost_price) : "",
      compare_at_price:
        defaultValues?.compare_at_price !== null && defaultValues?.compare_at_price !== undefined
          ? String(defaultValues.compare_at_price)
          : "",
      weight: defaultValues?.weight !== null && defaultValues?.weight !== undefined ? String(defaultValues.weight) : "",
      weight_unit: defaultValues?.weight_unit ?? "",
      track_stock: defaultValues?.track_stock ?? true,
      low_stock_threshold:
        defaultValues?.low_stock_threshold !== null && defaultValues?.low_stock_threshold !== undefined
          ? String(defaultValues.low_stock_threshold)
          : "",
      status: defaultValues?.status ?? "draft",
      featured: defaultValues?.featured ?? false,
    },
  });

  const categoryId = useWatch({ control, name: "category_id" });
  const brandId = useWatch({ control, name: "brand_id" });
  const type = useWatch({ control, name: "type" });
  const status = useWatch({ control, name: "status" });
  const weightUnit = useWatch({ control, name: "weight_unit" });
  const trackStock = useWatch({ control, name: "track_stock" });
  const featured = useWatch({ control, name: "featured" });
  const watchedName = useWatch({ control, name: "name" });
  const watchedSlug = useWatch({ control, name: "slug" });
  const watchedDescription = useWatch({ control, name: "description" });
  const watchedShort = useWatch({ control, name: "short_description" });

  const slugTouched = useRef(Boolean(defaultValues?.slug));
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!slugTouched.current) {
      setValue("slug", slugify(event.target.value), { shouldValidate: true });
    }
  };
  const nameField = register("name");
  const slugField = register("slug");

  async function generateSku() {
    setSkuLoading(true);
    try {
      const params = new URLSearchParams({ store_id: String(storeId) });
      if (brandId) params.set("brand_id", brandId);
      if (categoryId) params.set("category_id", categoryId);
      const result = await api.get<{ sku: string }>(`/products/next-sku?${params.toString()}`);
      setValue("sku", result.sku, { shouldDirty: true });
    } finally {
      setSkuLoading(false);
    }
  }

  const submit = handleSubmit(
    (values) => {
      setInvalid(false);
      onSubmit(
        {
          store_id: storeId,
          category_id: values.category_id ? Number(values.category_id) : null,
          brand_id: values.brand_id ? Number(values.brand_id) : null,
          type: values.type,
          name: values.name,
          slug: values.slug,
          // Blank is fine: the server generates one on create and keeps the current one on edit.
          sku: values.sku.trim(),
          barcode: values.barcode || null,
          description: values.description || null,
          short_description: values.short_description || null,
          price: values.price,
          sale_price: values.sale_price || null,
          cost_price: values.cost_price || null,
          compare_at_price: values.compare_at_price || null,
          weight: values.weight || null,
          weight_unit: values.weight_unit || null,
          track_stock: values.track_stock,
          low_stock_threshold: values.low_stock_threshold ? Number(values.low_stock_threshold) : null,
          status: values.status,
          featured: values.featured,
          seo: seoFieldsToPayload(seo),
        },
        files,
      );
    },
    () => setInvalid(true),
  );

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);

  return (
    <form onSubmit={submit} className="space-y-4">
      {serverError ? (
        <Alert variant="danger">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}
      {invalid ? (
        <Alert variant="danger">
          <AlertDescription>Some fields need attention — they are highlighted below.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="min-w-0 space-y-5">
          <Section title="Product">
            <div className="space-y-1.5">
              <Label htmlFor="name">Product name</Label>
              <Input
                id="name"
                className="h-11 text-base"
                placeholder="e.g. Joyroom A9 3A USB-A to Lightning Cable"
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
              <Label htmlFor="slug">Permalink (slug)</Label>
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

            <div className="space-y-1.5">
              <Label>Description</Label>
              <RichTextEditor
                value={watchedDescription}
                onChange={(html) => setValue("description", html === "<p></p>" ? "" : html, { shouldDirty: true })}
                placeholder="Write the full product description…"
                minHeight="18rem"
              />
              <p className="text-xs text-text-muted">
                Use headings (H2–H6), links, lists, images and the HTML view just like in WordPress.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="short_description">Short description</Label>
              <Textarea id="short_description" rows={3} {...register("short_description")} />
              <p className="text-xs text-text-muted">Shown beside the product images and used as the default meta description.</p>
            </div>
          </Section>

          <Section title="Pricing">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="price">Price (BDT)</Label>
                <Input id="price" inputMode="decimal" error={Boolean(errors.price)} {...register("price")} />
                {errors.price ? <p className="text-xs text-danger">{errors.price.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale_price">Sale price</Label>
                <Input id="sale_price" inputMode="decimal" error={Boolean(errors.sale_price)} {...register("sale_price")} />
                {errors.sale_price ? <p className="text-xs text-danger">{errors.sale_price.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="compare_at_price">Compare-at price</Label>
                <Input id="compare_at_price" inputMode="decimal" {...register("compare_at_price")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost_price">Cost price</Label>
                <Input id="cost_price" inputMode="decimal" {...register("cost_price")} />
              </div>
            </div>
          </Section>

          <Section title="Inventory & shipping">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU</Label>
                <div className="flex gap-2">
                  <Input
                    id="sku"
                    placeholder={productId ? "" : "Generated automatically on save"}
                    {...register("sku")}
                  />
                  <Button type="button" variant="outline" loading={skuLoading} onClick={generateSku}>
                    <Sparkles />
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-text-muted">
                  Leave blank to have one built from the brand (for example JOY-000123). You can also type your own.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="barcode">Barcode</Label>
                <Input id="barcode" {...register("barcode")} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="weight">Weight</Label>
                <div className="flex gap-2">
                  <Input id="weight" inputMode="decimal" {...register("weight")} />
                  <Select value={weightUnit} onValueChange={(value) => setValue("weight_unit", value, { shouldDirty: true })}>
                    <SelectTrigger className="w-24" aria-label="Weight unit">
                      <SelectValue placeholder="Unit">{weightUnit ? WEIGHT_UNIT_LABELS[weightUnit] : undefined}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="lb">lb</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {type !== "bundle" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="low_stock_threshold">Low-stock threshold</Label>
                  <Input id="low_stock_threshold" inputMode="numeric" {...register("low_stock_threshold")} />
                </div>
              ) : null}
            </div>

            {type === "bundle" ? (
              <p className="text-xs text-text-muted">
                A bundle never holds stock of its own — how many can be sold comes from its components&apos; stock.
              </p>
            ) : (
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <Checkbox
                  checked={trackStock}
                  onCheckedChange={(checked) => setValue("track_stock", checked === true, { shouldDirty: true })}
                />
                Track inventory for this product
              </label>
            )}
          </Section>

          {type === "variable" ? (
            <Section title="Variants" description="Define the attributes (size, colour…) and generate the variants.">
              {productId ? (
                <VariantsManager
                  storeId={storeId}
                  productId={productId}
                  currencyCode={defaultValues?.currency_code ?? "BDT"}
                  basePrice={defaultValues?.price ?? 0}
                  variants={defaultValues?.variants ?? []}
                  canEdit
                />
              ) : (
                <Alert variant="info">
                  <AlertDescription>Save the product once, then add its variants here.</AlertDescription>
                </Alert>
              )}
            </Section>
          ) : null}

          {type === "bundle" ? (
            <Section title="Bundle components" description="Choose the products this bundle is made of.">
              {productId ? (
                <ComponentsManager
                  storeId={storeId}
                  bundleProductId={productId}
                  components={defaultValues?.components ?? []}
                  bundleAvailability={defaultValues?.bundle_availability}
                  canEdit
                />
              ) : (
                <Alert variant="info">
                  <AlertDescription>Save the product once, then add its components here.</AlertDescription>
                </Alert>
              )}
            </Section>
          ) : null}

          <Section title="Product images">
            {productId ? (
              <ProductImageGallery productId={productId} images={defaultValues?.images ?? []} />
            ) : (
              <div className="space-y-3">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  aria-label="Choose product images"
                  onChange={(event) => {
                    const chosen = Array.from(event.target.files ?? []);
                    if (chosen.length > 0) setFiles((current) => [...current, ...chosen]);
                    event.target.value = "";
                  }}
                />
                {previews.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {previews.map((item, index) => (
                      <div key={`${item.file.name}-${index}`} className="relative overflow-hidden rounded-md border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a chosen file */}
                        <img src={item.url} alt="" className="aspect-square w-full object-cover" />
                        {index === 0 ? (
                          <span className="absolute left-1 top-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-white">
                            Primary
                          </span>
                        ) : null}
                        <button
                          type="button"
                          aria-label={`Remove ${item.file.name}`}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                          onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                  <ImagePlus />
                  {files.length > 0 ? "Add more images" : "Choose images"}
                </Button>
                <p className="text-xs text-text-muted">
                  Images upload when you create the product. The first one becomes the primary image.
                </p>
              </div>
            )}
          </Section>

          <Section title="SEO" description="Search-engine title, description, focus keyword and social previews.">
            <SeoFields
              value={seo}
              onChange={setSeo}
              titlePlaceholder={watchedName || defaultValues?.name}
              descriptionPlaceholder={watchedShort || defaultValues?.short_description || undefined}
              analysis={{
                kind: "product",
                slug: watchedSlug,
                content: [watchedShort, watchedDescription].filter(Boolean).join(" "),
                entityId: defaultValues?.id,
                images: defaultValues?.images?.map((image) => image.alt_text ?? ""),
              }}
            />
          </Section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 xl:sticky xl:top-4">
          <Section title="Publish">
            <div className="space-y-1.5">
              <Label htmlFor="product-form-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setValue("status", value as "draft" | "active" | "archived", { shouldDirty: true })}
              >
                <SelectTrigger id="product-form-status">
                  <SelectValue placeholder="Select status">{status ? STATUS_LABELS[status] : undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active (published)</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <Checkbox
                checked={featured}
                onCheckedChange={(checked) => setValue("featured", checked === true, { shouldDirty: true })}
              />
              Featured product
            </label>
            <Button type="submit" className="w-full" loading={isPending}>
              {submitLabel}
            </Button>
          </Section>

          <Section title="Organisation">
            <div className="space-y-1.5">
              <Label htmlFor="product-form-category">Category</Label>
              <Select
                value={categoryId}
                onValueChange={(value) => setValue("category_id", value === "none" ? "" : value, { shouldDirty: true })}
              >
                <SelectTrigger id="product-form-category">
                  <SelectValue placeholder="None">
                    {categoryId ? categories.find((c) => String(c.id) === categoryId)?.name : "None"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-form-brand">Brand</Label>
              <Select
                value={brandId}
                onValueChange={(value) => setValue("brand_id", value === "none" ? "" : value, { shouldDirty: true })}
              >
                <SelectTrigger id="product-form-brand">
                  <SelectValue placeholder="None">
                    {brandId ? brands.find((b) => String(b.id) === brandId)?.name : "None"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="product-form-type">Product type</Label>
              <Select
                value={type}
                onValueChange={(value) => setValue("type", value as "simple" | "variable" | "bundle", { shouldDirty: true })}
              >
                <SelectTrigger id="product-form-type">
                  <SelectValue placeholder="Select type">{type ? TYPE_LABELS[type] : undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple</SelectItem>
                  <SelectItem value="variable">Variable (has variants)</SelectItem>
                  <SelectItem value="bundle">Bundle (combo of other products)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Section>
        </aside>
      </div>
    </form>
  );
}
