"use client";

import Link from "next/link";
import { Minus, Package, Plus, X } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { useCartStore, type CartItem } from "@/stores/cart-store";

export function CartLineItem({ item }: { item: CartItem }) {
  const { updateQuantity, removeItem } = useCartStore();

  return (
    <div className="flex gap-3 py-3">
      <Link
        href={`/products/${item.slug}`}
        className="flex size-16 shrink-0 items-center justify-center overflow-hidden border border-border bg-white p-1"
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
          <img src={item.imageUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
        ) : (
          <Package className="size-6 text-text-muted" />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/products/${item.slug}`}
              className="line-clamp-2 text-sm font-medium text-text-primary hover:text-shop-ink"
            >
              {item.name}
            </Link>
            {item.variantLabel ? <p className="text-xs text-text-muted">{item.variantLabel}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => removeItem(item.productId, item.variantId)}
            aria-label={`Remove ${item.name}`}
            className="shrink-0 text-text-muted hover:text-danger"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="inline-flex items-center border border-border">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => updateQuantity(item.productId, item.variantId, item.quantity - 1)}
              className="flex size-7 items-center justify-center text-text-secondary hover:bg-border/40"
            >
              <Minus className="size-3" />
            </button>
            <span className="w-8 text-center text-sm">{item.quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => updateQuantity(item.productId, item.variantId, item.quantity + 1)}
              className="flex size-7 items-center justify-center text-text-secondary hover:bg-border/40"
            >
              <Plus className="size-3" />
            </button>
          </div>
          <span className="text-sm font-semibold text-shop-ink">
            {formatMoney(item.unitPrice * item.quantity, item.currencyCode)}
          </span>
        </div>
      </div>
    </div>
  );
}
