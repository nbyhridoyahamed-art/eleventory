"use client";

import Link from "next/link";
import { Package, Star } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import type { StorefrontProduct } from "@/types/storefront";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn("size-3", n <= Math.round(rating) ? "fill-shop-accent text-shop-accent" : "text-border")}
        />
      ))}
    </div>
  );
}

/**
 * Product tile for the shop listing — sits inside a bordered grid, so the
 * tile itself has no border of its own (the grid draws the shared lines).
 * `layout="list"` lays the image beside the details for the list view.
 */
export function ShopProductCard({
  product,
  layout = "grid",
}: {
  product: StorefrontProduct;
  layout?: "grid" | "list";
}) {
  const addItem = useCartStore((state) => state.addItem);

  const onSale = product.sale_price !== null && product.sale_price < product.price;
  const discount = onSale ? Math.round(((product.price - product.sale_price!) / product.price) * 100) : 0;
  const href = `/products/${product.slug}`;
  const canQuickAdd = product.in_stock && product.type === "simple";

  function handleAdd() {
    addItem({
      productId: product.id,
      variantId: null,
      name: product.name,
      slug: product.slug,
      variantLabel: null,
      imageUrl: product.primary_image_url,
      unitPrice: onSale ? product.sale_price! : product.price,
      currencyCode: product.currency_code,
    });
  }

  const buttonClass =
    "block w-full bg-shop-accent px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-shop-on-accent transition-colors hover:bg-shop-accent-hover";

  const action = canQuickAdd ? (
    <button type="button" onClick={handleAdd} className={buttonClass}>
      Add to cart
    </button>
  ) : (
    <Link href={href} className={buttonClass}>
      {product.in_stock ? "Select options" : "Read more"}
    </Link>
  );

  const price = (
    <div className="flex flex-wrap items-baseline gap-x-2">
      {onSale ? (
        <span className="text-xs text-text-muted line-through">{formatMoney(product.price, product.currency_code)}</span>
      ) : null}
      <span className="text-base font-semibold text-shop-ink">
        {formatMoney(onSale ? product.sale_price! : product.price, product.currency_code)}
      </span>
    </div>
  );

  const image = (
    <Link
      href={href}
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-white",
        layout === "grid" ? "aspect-square w-full p-4" : "aspect-square w-40 shrink-0 p-3 tablet:w-52",
      )}
    >
      {product.primary_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
        <img
          src={product.primary_image_url}
          alt={product.name}
          loading="lazy"
          className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <Package className="size-10 text-text-muted" />
      )}
      {discount > 0 ? (
        <span className="absolute left-2 top-2 bg-shop-accent px-1.5 py-0.5 text-[11px] font-semibold text-shop-on-accent">
          -{discount}%
        </span>
      ) : null}
      {!product.in_stock ? (
        <span className="absolute right-2 top-2 border border-border bg-white px-1.5 py-0.5 text-[11px] font-medium text-text-secondary">
          Out of stock
        </span>
      ) : null}
    </Link>
  );

  if (layout === "list") {
    return (
      <article className="group flex items-stretch gap-4 bg-surface">
        {image}
        <div className="flex flex-1 flex-col justify-center gap-2 py-3 pr-4">
          <Link href={href} className="line-clamp-2 text-sm font-medium text-text-primary hover:text-shop-ink">
            {product.name}
          </Link>
          {product.average_rating !== null ? <Stars rating={product.average_rating} /> : null}
          {price}
          <div className="w-44">{action}</div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col bg-surface">
      {image}
      <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4">
        <Link href={href} className="line-clamp-2 min-h-[2.5rem] text-[13px] font-medium text-text-primary hover:text-shop-ink">
          {product.name}
        </Link>
        <div className="min-h-3">{product.average_rating !== null ? <Stars rating={product.average_rating} /> : null}</div>
        {price}
        <div className="mt-auto pt-2">{action}</div>
      </div>
    </article>
  );
}
