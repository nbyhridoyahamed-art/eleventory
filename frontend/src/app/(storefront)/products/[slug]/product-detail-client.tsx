"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { BadgeCheck, Check, Minus, Package, Plus, Share2, Star, Tag, Truck } from "lucide-react";
import { toast } from "sonner";

import { trackEvent } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ApiError } from "@/types/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopProductCard } from "@/components/storefront/shop-product-card";
import { useStorefrontProduct, useStorefrontProducts } from "@/hooks/use-storefront-catalog";
import { useCartStore } from "@/stores/cart-store";
import type { StorefrontVariant } from "@/types/storefront";
import { ProductReviews } from "./product-reviews";

function attributeOptions(variants: StorefrontVariant[]): Map<string, string[]> {
  const options = new Map<string, string[]>();

  for (const variant of variants) {
    for (const { attribute_name, value } of variant.attribute_values) {
      const values = options.get(attribute_name) ?? [];
      if (!values.includes(value)) values.push(value);
      options.set(attribute_name, values);
    }
  }

  return options;
}

function matchVariant(variants: StorefrontVariant[], selected: Record<string, string>, attributeNames: string[]) {
  if (attributeNames.some((name) => !selected[name])) return null;

  return (
    variants.find((variant) =>
      attributeNames.every(
        (name) => variant.attribute_values.find((av) => av.attribute_name === name)?.value === selected[name],
      ),
    ) ?? null
  );
}

type Tab = "description" | "info" | "reviews" | "shipping";

const PRIMARY_BUTTON =
  "flex-1 bg-shop-accent px-6 py-3 text-xs font-semibold uppercase tracking-wide text-shop-on-accent transition-colors hover:bg-shop-accent-hover disabled:cursor-not-allowed disabled:opacity-50";
const NAVY_BUTTON =
  "w-full bg-shop-ink px-6 py-3 text-xs font-semibold uppercase tracking-wide text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The interactive PDP — a Client Component so it can fetch live data
 * (TanStack Query) and handle variant selection/cart state. Its parent
 * page.tsx is a Server Component that fetches the same product once more,
 * server-side, purely to build real <head> metadata and JSON-LD — see
 * ARCHITECTURE.md's "fetch twice, once per side" note on why this app's
 * storefront can't yet share one fetch across both.
 */
export function ProductDetailClient({ slug }: { slug: string }) {
  const router = useRouter();
  const { data: product, isLoading, error } = useStorefrontProduct(slug);
  const addItem = useCartStore((state) => state.addItem);

  const [activeImage, setActiveImage] = useState(0);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState<Tab>("description");
  const [showStickyBar, setShowStickyBar] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  const { data: related } = useStorefrontProducts({ category: product?.category?.slug });

  const attributeNames = useMemo(
    () => (product ? Array.from(attributeOptions(product.variants).keys()) : []),
    [product],
  );
  const attributeChoices = useMemo(
    () => (product ? attributeOptions(product.variants) : new Map<string, string[]>()),
    [product],
  );
  const matchedVariant = useMemo(
    () => (product ? matchVariant(product.variants, selectedAttributes, attributeNames) : null),
    [product, selectedAttributes, attributeNames],
  );

  useEffect(() => {
    const productId = product?.id;
    if (!productId) return;
    trackEvent("product_view", { product_id: productId });
  }, [product?.id]);

  // Show the compact sticky buy bar once the main add-to-cart block scrolls out of view.
  useEffect(() => {
    const node = ctaRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setShowStickyBar(!entry.isIntersecting), { threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [product?.id]);

  if (error instanceof ApiError && error.status === 404) {
    notFound();
  }

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-8 tablet:grid-cols-2">
        <Skeleton className="aspect-square w-full" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-16 text-center">
        <p className="text-text-secondary">Something went wrong loading this product. Please try again.</p>
      </div>
    );
  }

  const isVariable = product.type === "variable";
  const isBundle = product.type === "bundle";
  const needsVariantSelection = isVariable && product.variants.length > 0;

  const effectivePrice = matchedVariant?.price ?? product.price;
  const effectiveSalePrice = matchedVariant ? matchedVariant.sale_price : product.sale_price;
  const onSale = effectiveSalePrice !== null && effectiveSalePrice < effectivePrice;
  const displayPrice = onSale ? effectiveSalePrice! : effectivePrice;

  const inStock = needsVariantSelection ? (matchedVariant ? matchedVariant.in_stock : true) : product.in_stock;
  const canAddToCart = inStock && (!needsVariantSelection || matchedVariant !== null);

  const images = product.images.length > 0 ? product.images : [];
  const relatedProducts = (related?.data ?? []).filter((item) => item.id !== product.id).slice(0, 6);

  const buttonLabel = !inStock ? "Out of stock" : needsVariantSelection && !matchedVariant ? "Select options" : "Add to cart";

  function addCurrentToCart() {
    addItem(
      {
        productId: product!.id,
        variantId: matchedVariant?.id ?? null,
        name: product!.name,
        slug: product!.slug,
        variantLabel: matchedVariant ? matchedVariant.attribute_values.map((av) => av.value).join(" / ") : null,
        imageUrl: images[0]?.url ?? null,
        unitPrice: displayPrice,
        currencyCode: product!.currency_code,
      },
      quantity,
    );
  }

  function handleAddToCart() {
    if (!canAddToCart) return;
    addCurrentToCart();
  }

  function handleBuyNow() {
    if (!canAddToCart) return;
    addCurrentToCart();
    router.push("/checkout");
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product!.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch {
      // The share sheet being dismissed isn't an error worth surfacing.
    }
  }

  const infoRows: [string, string][] = [
    ["SKU", product.sku],
    ...(product.brand ? ([["Brand", product.brand.name]] as [string, string][]) : []),
    ...(product.category ? ([["Category", product.category.name]] as [string, string][]) : []),
    ...(product.weight ? ([["Weight", `${product.weight} ${product.weight_unit ?? ""}`.trim()]] as [string, string][]) : []),
    ...attributeNames.map((name) => [name, (attributeChoices.get(name) ?? []).join(", ")] as [string, string]),
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: "description", label: "Description" },
    { id: "info", label: "Additional information" },
    { id: "reviews", label: `Reviews (${product.reviews_count})` },
    { id: "shipping", label: "Shipping & Return" },
  ];

  return (
    <div>
      {/* Breadcrumb banner */}
      <div className="bg-shop-tint">
        <nav
          aria-label="Breadcrumb"
          className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-1 px-4 py-6 text-center text-xs text-text-secondary"
        >
          <Link href="/" className="hover:text-shop-ink">
            Home
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:text-shop-ink">
            Shop
          </Link>
          {product.category ? (
            <>
              <span>/</span>
              <Link href={`/category/${product.category.slug}`} className="hover:text-shop-ink">
                {product.category.name}
              </Link>
            </>
          ) : null}
          <span>/</span>
          <span className="text-text-primary">{product.name}</span>
        </nav>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-8">
        <div className="grid gap-8 desktop:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Gallery */}
          <div className="space-y-4">
            <div className="flex gap-3">
              {images.length > 1 ? (
                <div className="hidden w-20 shrink-0 flex-col gap-2 tablet:flex">
                  {images.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      aria-label={`Show image ${index + 1}`}
                      className={cn(
                        "flex aspect-square items-center justify-center overflow-hidden border bg-white p-1",
                        index === activeImage ? "border-shop-accent" : "border-border",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset */}
                      <img src={image.url} alt="" className="max-h-full max-w-full object-contain" />
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex aspect-square min-w-0 flex-1 items-center justify-center overflow-hidden border border-border bg-white p-4">
                {images[activeImage] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
                  <img
                    src={images[activeImage].url}
                    alt={images[activeImage].alt_text ?? product.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <Package className="size-16 text-text-muted" />
                )}
              </div>
            </div>

            {images.length > 1 ? (
              <div className="flex gap-2 tablet:hidden">
                {images.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`Show image ${index + 1}`}
                    className={cn(
                      "size-16 shrink-0 overflow-hidden border bg-white p-1",
                      index === activeImage ? "border-shop-accent" : "border-border",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset */}
                    <img src={image.url} alt="" className="size-full object-contain" />
                  </button>
                ))}
              </div>
            ) : null}

            <ul className="grid grid-cols-3 divide-x divide-border border border-border bg-surface text-xs font-medium text-text-primary">
              {[
                [BadgeCheck, "100% Original"],
                [Tag, "Best Price"],
                [Truck, "Nationwide Delivery"],
              ].map(([Icon, label]) => {
                const TrustIcon = Icon as typeof BadgeCheck;
                return (
                  <li key={label as string} className="flex flex-col items-center gap-1.5 px-2 py-3 text-center tablet:flex-row tablet:justify-center">
                    <TrustIcon className="size-4 text-shop-ink" />
                    {label as string}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Summary */}
          <div className="space-y-4">
            <div className="space-y-2">
              {product.brand ? (
                <p className="text-sm text-text-secondary">
                  Brand:{" "}
                  <Link href={`/brand/${product.brand.slug}`} className="font-medium text-shop-ink hover:underline">
                    {product.brand.name}
                  </Link>
                </p>
              ) : null}
              <h1 className="text-section font-semibold leading-snug text-text-primary tablet:text-page-title">
                {product.name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-page-title font-bold text-shop-ink">
                {formatMoney(displayPrice, product.currency_code)}
              </span>
              {onSale ? (
                <span className="text-text-muted line-through">{formatMoney(effectivePrice, product.currency_code)}</span>
              ) : null}
              {onSale ? (
                <span className="bg-shop-accent px-1.5 py-0.5 text-xs font-semibold text-shop-on-accent">
                  -{Math.round(((effectivePrice - displayPrice) / effectivePrice) * 100)}%
                </span>
              ) : null}
              {product.reviews_count > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setTab("reviews");
                    document.getElementById("product-tabs")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-shop-ink"
                >
                  <span className="flex items-center gap-0.5" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={cn(
                          "size-3.5",
                          n <= Math.round(product.average_rating ?? 0) ? "fill-shop-accent text-shop-accent" : "text-border",
                        )}
                      />
                    ))}
                  </span>
                  ({product.reviews_count} review{product.reviews_count === 1 ? "" : "s"})
                </button>
              ) : null}
            </div>

            {product.short_description ? (
              <p className="text-sm leading-relaxed text-text-secondary">{product.short_description}</p>
            ) : null}

            <p
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium",
                inStock ? "bg-success/10 text-success" : "bg-border/50 text-text-secondary",
              )}
            >
              {inStock ? <Check className="size-3.5" /> : null}
              {inStock ? "In stock" : "Out of stock"}
            </p>

            {isBundle && product.components && product.components.length > 0 ? (
              <div className="space-y-2 border border-border p-3">
                <p className="text-sm font-medium text-text-primary">This bundle includes:</p>
                <ul className="space-y-1 text-sm text-text-secondary">
                  {product.components.map((component, index) => (
                    <li key={index}>
                      {component.quantity}x {component.product_name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {needsVariantSelection ? (
              <div className="space-y-3">
                {attributeNames.map((name) => (
                  <div key={name} className="space-y-1.5">
                    <p className="text-sm font-medium text-text-primary">{name}</p>
                    <div className="flex flex-wrap gap-2">
                      {(attributeChoices.get(name) ?? []).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSelectedAttributes((prev) => ({ ...prev, [name]: value }))}
                          aria-pressed={selectedAttributes[name] === value}
                          className={cn(
                            "border px-3 py-1.5 text-sm",
                            selectedAttributes[name] === value
                              ? "border-shop-accent bg-shop-accent/15 font-medium text-text-primary"
                              : "border-border text-text-primary hover:bg-border/30",
                          )}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div ref={ctaRef} className="space-y-3">
              <div className="flex items-stretch gap-3">
                <div className="flex items-center border border-border">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex size-11 items-center justify-center text-text-secondary hover:bg-border/40"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-10 text-center text-sm font-medium" aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity((q) => Math.min(100, q + 1))}
                    className="flex size-11 items-center justify-center text-text-secondary hover:bg-border/40"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <button type="button" disabled={!canAddToCart} onClick={handleAddToCart} className={PRIMARY_BUTTON}>
                  {buttonLabel}
                </button>
              </div>
              <button type="button" disabled={!canAddToCart} onClick={handleBuyNow} className={NAVY_BUTTON}>
                Buy now
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-xs font-medium uppercase tracking-wide text-text-secondary">
              <button type="button" onClick={handleShare} className="flex items-center gap-2 hover:text-shop-ink">
                <Share2 className="size-4" />
                Share
              </button>
            </div>

            <ul className="space-y-2 border border-border bg-shop-tint p-4 text-sm text-text-secondary">
              <li className="flex gap-2">
                <Truck className="mt-0.5 size-4 shrink-0 text-shop-ink" />
                <span>
                  <span className="font-medium text-text-primary">Estimated delivery:</span> 1–2 working days inside
                  Dhaka, 3–5 working days outside Dhaka.
                </span>
              </li>
              <li className="flex gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-shop-ink" />
                <span>
                  <span className="font-medium text-text-primary">Cash on Delivery</span> available nationwide, with
                  easy 7-day returns on eligible items.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Tabs */}
        <section id="product-tabs" className="mt-12 scroll-mt-24 border border-border bg-surface">
          <div role="tablist" className="flex flex-wrap justify-center gap-x-8 border-b border-border px-4">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "-mb-px border-b-2 px-1 py-4 text-xs font-semibold uppercase tracking-wide transition-colors",
                  tab === item.id
                    ? "border-shop-accent text-text-primary"
                    : "border-transparent text-text-secondary hover:text-text-primary",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="p-5 tablet:p-8">
            {tab === "description" ? (
              product.description ? (
                <div className="space-y-3">
                  <h2 className="text-section font-semibold text-text-primary">About this item</h2>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">{product.description}</p>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">No description has been added for this product yet.</p>
              )
            ) : null}

            {tab === "info" ? (
              <table className="w-full max-w-3xl text-sm">
                <tbody>
                  {infoRows.map(([label, value], index) => (
                    <tr key={label} className={index % 2 === 0 ? "bg-border/25" : ""}>
                      <th scope="row" className="w-1/3 px-4 py-2.5 text-left font-medium text-text-primary">
                        {label}
                      </th>
                      <td className="px-4 py-2.5 text-text-secondary">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {tab === "reviews" ? <ProductReviews product={product} /> : null}

            {tab === "shipping" ? (
              <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-text-secondary">
                <div>
                  <h3 className="mb-1 font-semibold text-text-primary">Delivery</h3>
                  <p>
                    We deliver across all 8 divisions of Bangladesh. Inside Dhaka orders typically arrive within 1–2
                    working days; outside Dhaka within 3–5 working days. Delivery charges are shown at checkout.
                  </p>
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-text-primary">Returns &amp; refunds</h3>
                  <p>
                    Most items can be returned within 7 days of delivery, unused and in original condition and
                    packaging. Refunds go to the original payment method or as store credit.
                  </p>
                </div>
                <p>
                  See our{" "}
                  <Link href="/pages/shipping-policy" className="text-shop-ink hover:underline">
                    Shipping Policy
                  </Link>{" "}
                  and{" "}
                  <Link href="/pages/return-refund-policy" className="text-shop-ink hover:underline">
                    Return &amp; Refund Policy
                  </Link>
                  .
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {/* Related products */}
        {relatedProducts.length > 0 ? (
          <section className="mt-12 space-y-6">
            <h2 className="text-center text-page-title font-semibold text-text-primary">Related Products</h2>
            <div className="grid grid-cols-2 border-l border-t border-border tablet:grid-cols-3 desktop:grid-cols-6">
              {relatedProducts.map((item) => (
                <div key={item.id} className="border-b border-r border-border">
                  <ShopProductCard product={item} />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {/* Sticky buy bar */}
      <div
        aria-hidden={!showStickyBar}
        className={cn(
          "fixed inset-x-0 bottom-14 z-30 border-t border-border bg-surface shadow-lg transition-transform duration-200 desktop:bottom-0",
          showStickyBar ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2">
          {images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
            <img src={images[0].url} alt="" className="hidden size-10 object-contain tablet:block" />
          ) : null}
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{product.name}</p>
          <span className="shrink-0 font-semibold text-shop-ink">{formatMoney(displayPrice, product.currency_code)}</span>
          <button
            type="button"
            tabIndex={showStickyBar ? 0 : -1}
            disabled={!canAddToCart}
            onClick={handleAddToCart}
            className="shrink-0 bg-shop-accent px-4 py-2 text-xs font-semibold uppercase tracking-wide text-shop-on-accent hover:bg-shop-accent-hover disabled:opacity-50"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
