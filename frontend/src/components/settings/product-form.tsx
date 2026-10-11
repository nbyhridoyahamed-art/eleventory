"use client";

import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slugify";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
    sku: z.string().min(1, "SKU is required."),
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

const STATUS_LABELS: Record<string, string> = { draft: "Draft", active: "Active", archived: "Archived" };
const WEIGHT_UNIT_LABELS: Record<string, string> = { kg: "kg", g: "g", lb: "lb" };
const TYPE_LABELS: Record<string, string> = {
  simple: "Simple",
  variable: "Variable (has variants)",
  bundle: "Bundle (combo of other products)",
};

const TABS = ["General", "Pricing", "Variants", "Components", "Media", "SEO"] as const;

interface ProductFormProps {
  storeId: number;
  categories: Category[];
  brands: Brand[];
  defaultValues?: Product;
  productId?: number;
  onSubmit: (values: ProductFormValues) => void;
  isPending: boolean;
  serverError?: string | null;
  submitLabel: string;
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
  const [tab, setTab] = useState<(typeof TABS)[number]>("General");
  const [seo, setSeo] = useState(() => seoToFieldsValue(defaultValues?.seo));

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

  const submit = handleSubmit((values) => {
    onSubmit({
      store_id: storeId,
      category_id: values.category_id ? Number(values.category_id) : null,
      brand_id: values.brand_id ? Number(values.brand_id) : null,
      type: values.type,
      name: values.name,
      slug: values.slug,
      sku: values.sku,
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
    });
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      {serverError ? (
        <Alert variant="danger">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="border-b border-border">
        <nav aria-label="Product form sections" className="flex gap-1">
          {TABS.filter((t) => (t !== "Variants" || type === "variable") && (t !== "Components" || type === "bundle")).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary",
              )}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      <div className={tab === "General" ? "space-y-4" : "hidden"}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Product name</Label>
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
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" error={Boolean(errors.sku)} {...register("sku")} />
            {errors.sku ? <p className="text-xs text-danger">{errors.sku.message}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="barcode">Barcode</Label>
            <Input id="barcode" {...register("barcode")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="product-form-type">Product type</Label>
          <Select
            value={type}
            onValueChange={(value) => setValue("type", value as "simple" | "variable" | "bundle", { shouldDirty: true })}
          >
            <SelectTrigger id="product-form-type" className="max-w-xs">
              <SelectValue placeholder="Select type">{type ? TYPE_LABELS[type] : undefined}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">Simple</SelectItem>
              <SelectItem value="variable">Variable (has variants)</SelectItem>
              <SelectItem value="bundle">Bundle (combo of other products)</SelectItem>
            </SelectContent>
          </Select>
          {type === "variable" ? (
            <p className="text-xs text-text-muted">
              Save the product, then use the Variants tab to define its attributes and generate variants.
            </p>
          ) : null}
          {type === "bundle" ? (
            <p className="text-xs text-text-muted">
              Save the product, then use the Components tab to choose what it&apos;s made of. A bundle never holds its
              own stock — it&apos;s only ever as available as its components.
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="short_description">Short description</Label>
          <Textarea id="short_description" rows={2} {...register("short_description")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={5} {...register("description")} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="product-form-status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                setValue("status", value as "draft" | "active" | "archived", { shouldDirty: true })
              }
            >
              <SelectTrigger id="product-form-status">
                <SelectValue placeholder="Select status">{status ? STATUS_LABELS[status] : undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <Checkbox
                checked={featured}
                onCheckedChange={(checked) => setValue("featured", checked === true, { shouldDirty: true })}
              />
              Featured product
            </label>
          </div>
        </div>
      </div>

      <div className={tab === "Pricing" ? "space-y-4" : "hidden"}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="price">Price (BDT)</Label>
            <Input id="price" inputMode="decimal" error={Boolean(errors.price)} {...register("price")} />
            {errors.price ? <p className="text-xs text-danger">{errors.price.message}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sale_price">Sale price</Label>
            <Input
              id="sale_price"
              inputMode="decimal"
              error={Boolean(errors.sale_price)}
              {...register("sale_price")}
            />
            {errors.sale_price ? <p className="text-xs text-danger">{errors.sale_price.message}</p> : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cost_price">Cost price</Label>
            <Input id="cost_price" inputMode="decimal" {...register("cost_price")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="compare_at_price">Compare-at price</Label>
            <Input id="compare_at_price" inputMode="decimal" {...register("compare_at_price")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="weight">Weight</Label>
            <div className="flex gap-2">
              <Input id="weight" inputMode="decimal" {...register("weight")} />
              <Select
                value={weightUnit}
                onValueChange={(value) => setValue("weight_unit", value, { shouldDirty: true })}
              >
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
            A bundle never holds stock of its own, so it&apos;s never tracked or shown on the Low Stock report
            directly — how many can be sold is derived from its components&apos; own stock instead.
          </p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <Checkbox
                checked={trackStock}
                onCheckedChange={(checked) => setValue("track_stock", checked === true, { shouldDirty: true })}
              />
              Track inventory for this product
            </label>
            {trackStock ? (
              <p className="text-xs text-text-muted">
                Real-time stock levels and movements arrive with Phase 6 (Inventory) — this only reserves the
                setting for later.
              </p>
            ) : null}
          </>
        )}
      </div>

      {type === "variable" ? (
        <div className={tab === "Variants" ? "space-y-4" : "hidden"}>
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
              <AlertDescription>Save the product first, then come back here to add variants.</AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}

      {type === "bundle" ? (
        <div className={tab === "Components" ? "space-y-4" : "hidden"}>
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
              <AlertDescription>Save the product first, then come back here to add components.</AlertDescription>
            </Alert>
          )}
        </div>
      ) : null}

      <div className={tab === "Media" ? "space-y-4" : "hidden"}>
        {productId ? (
          <ProductImageGallery productId={productId} images={defaultValues?.images ?? []} />
        ) : (
          <Alert variant="info">
            <AlertDescription>Save the product first, then come back here to add images.</AlertDescription>
          </Alert>
        )}
      </div>

      <div className={tab === "SEO" ? "space-y-4" : "hidden"}>
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
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" loading={isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
