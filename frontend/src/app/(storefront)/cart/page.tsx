"use client";

import Link from "next/link";
import { BadgeCheck, Minus, Package, Plus, ShoppingCart, Trash2, Truck, X } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { PageBanner } from "@/components/storefront/page-banner";
import { useCartStore, type CartItem } from "@/stores/cart-store";

const ACCENT_BUTTON =
  "block w-full bg-shop-accent px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-shop-on-accent transition-colors hover:bg-shop-accent-hover";
const OUTLINE_BUTTON =
  "block w-full border border-border bg-surface px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-primary transition-colors hover:border-shop-accent";

function QuantityStepper({ item }: { item: CartItem }) {
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  return (
    <div className="inline-flex items-center border border-border">
      <button
        type="button"
        aria-label={`Decrease quantity of ${item.name}`}
        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
        className="flex size-9 items-center justify-center text-text-secondary hover:bg-border/40"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-10 text-center text-sm font-medium" aria-live="polite">
        {item.quantity}
      </span>
      <button
        type="button"
        aria-label={`Increase quantity of ${item.name}`}
        onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
        className="flex size-9 items-center justify-center text-text-secondary hover:bg-border/40"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function CartRow({ item }: { item: CartItem }) {
  const removeItem = useCartStore((state) => state.removeItem);

  return (
    <li className="grid grid-cols-[88px_1fr] gap-x-4 gap-y-3 border-b border-border p-4 tablet:grid-cols-[96px_1fr_110px_140px_110px_40px] tablet:items-center">
      <Link
        href={`/products/${item.slug}`}
        className="row-span-2 flex size-[88px] items-center justify-center overflow-hidden border border-border bg-white p-1.5 tablet:row-span-1 tablet:size-24"
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
          <img src={item.imageUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
        ) : (
          <Package className="size-6 text-text-muted" />
        )}
      </Link>

      <div className="min-w-0 pr-6 tablet:pr-0">
        <Link href={`/products/${item.slug}`} className="line-clamp-2 text-sm font-medium text-text-primary hover:text-shop-ink">
          {item.name}
        </Link>
        {item.variantLabel ? <p className="mt-0.5 text-xs text-text-muted">{item.variantLabel}</p> : null}
        <p className="mt-1 text-sm text-text-secondary tablet:hidden">{formatMoney(item.unitPrice, item.currencyCode)}</p>
      </div>

      <p className="hidden text-sm text-text-secondary tablet:block">{formatMoney(item.unitPrice, item.currencyCode)}</p>

      <div className="flex items-center justify-between gap-3 tablet:block">
        <QuantityStepper item={item} />
        <p className="text-sm font-semibold text-shop-ink tablet:hidden">
          {formatMoney(item.unitPrice * item.quantity, item.currencyCode)}
        </p>
      </div>

      <p className="hidden text-sm font-semibold text-shop-ink tablet:block">
        {formatMoney(item.unitPrice * item.quantity, item.currencyCode)}
      </p>

      <button
        type="button"
        onClick={() => removeItem(item.productId, item.variantId)}
        aria-label={`Remove ${item.name}`}
        className="absolute right-3 top-3 text-text-muted hover:text-danger tablet:static"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

export default function CartPage() {
  const { items, clear } = useCartStore();
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const currencyCode = items[0]?.currencyCode ?? "BDT";

  const crumbs = [{ label: "Home", href: "/" }, { label: "Shopping Cart" }];

  if (items.length === 0) {
    return (
      <div>
        <PageBanner title="Shopping Cart" crumbs={crumbs} />
        <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-4 px-4 py-20 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-shop-tint text-shop-ink">
            <ShoppingCart className="size-9" />
          </span>
          <h2 className="text-section font-semibold text-text-primary">Your cart is empty</h2>
          <p className="text-sm text-text-secondary">Browse products and add something you like.</p>
          <Link
            href="/products"
            className="bg-shop-accent px-8 py-3 text-xs font-semibold uppercase tracking-wide text-shop-on-accent hover:bg-shop-accent-hover"
          >
            Return to shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBanner title="Shopping Cart" crumbs={crumbs} />

      <div className="mx-auto max-w-[1400px] px-4 py-8">
        <div className="grid gap-8 desktop:grid-cols-[minmax(0,1fr)_360px]">
          <section aria-label="Cart items" className="border-l border-t border-border bg-surface">
            <div className="hidden grid-cols-[96px_1fr_110px_140px_110px_40px] gap-x-4 border-b border-r border-border bg-shop-tint px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary tablet:grid">
              <span>Product</span>
              <span />
              <span>Price</span>
              <span>Quantity</span>
              <span>Total</span>
              <span />
            </div>
            <ul className="border-r border-border [&>li]:relative">
              {items.map((item) => (
                <CartRow key={`${item.productId}:${item.variantId ?? "0"}`} item={item} />
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-r border-border p-4">
              <Link href="/products" className="text-sm font-medium text-shop-ink hover:underline">
                &larr; Continue shopping
              </Link>
              <button
                type="button"
                onClick={clear}
                className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-danger"
              >
                <Trash2 className="size-4" />
                Clear cart
              </button>
            </div>
          </section>

          <aside className="space-y-4 self-start">
            <div className="border border-border bg-surface">
              <h2 className="border-b border-border bg-shop-tint px-5 py-3 text-sm font-semibold uppercase tracking-wide text-text-primary">
                Cart totals
              </h2>
              <dl className="space-y-3 p-5 text-sm">
                <div className="flex justify-between text-text-secondary">
                  <dt>Items</dt>
                  <dd>{itemCount}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-text-primary">
                  <dt>Subtotal</dt>
                  <dd className="text-shop-ink">{formatMoney(subtotal, currencyCode)}</dd>
                </div>
              </dl>
              <div className="space-y-3 border-t border-border p-5">
                <p className="text-xs text-text-muted">
                  Prices shown are estimates from when items were added. Shipping and the exact total are confirmed at
                  checkout.
                </p>
                <Link href="/checkout" className={ACCENT_BUTTON}>
                  Proceed to checkout
                </Link>
                <Link href="/products" className={OUTLINE_BUTTON}>
                  Continue shopping
                </Link>
              </div>
            </div>

            <ul className="space-y-2 border border-border bg-shop-tint p-4 text-sm text-text-secondary">
              <li className="flex gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-shop-ink" />
                Cash on Delivery available nationwide
              </li>
              <li className="flex gap-2">
                <Truck className="mt-0.5 size-4 shrink-0 text-shop-ink" />
                1–2 days inside Dhaka, 3–5 days outside
              </li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
