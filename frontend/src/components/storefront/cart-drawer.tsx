"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CartLineItem } from "@/components/storefront/cart-line-item";
import { useCartStore } from "@/stores/cart-store";

export function CartDrawer() {
  const { items, isOpen, closeCart } = useCartStore();
  const currencyCode = items[0]?.currencyCode ?? "BDT";
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (open ? undefined : closeCart())}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col gap-0 p-0 [&>button]:text-shop-on-nav">
        <SheetHeader className="border-b border-border bg-shop-nav px-5 py-4">
          <SheetTitle className="text-shop-on-nav">
            Shopping cart{itemCount > 0 ? ` (${itemCount})` : ""}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-shop-tint text-shop-ink">
              <ShoppingCart className="size-7" />
            </span>
            <p className="font-semibold text-text-primary">Your cart is empty</p>
            <p className="text-sm text-text-secondary">Browse products and add something you like.</p>
            <Link
              href="/products"
              onClick={closeCart}
              className="mt-2 bg-shop-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-shop-on-accent hover:bg-shop-accent-hover"
            >
              Continue shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 divide-y divide-border overflow-y-auto px-5">
              {items.map((item) => (
                <CartLineItem key={`${item.productId}:${item.variantId ?? "0"}`} item={item} />
              ))}
            </div>

            <div className="space-y-3 border-t border-border bg-shop-tint p-5">
              <div className="flex items-center justify-between text-sm font-semibold text-text-primary">
                <span>Subtotal</span>
                <span className="text-base text-shop-ink">{formatMoney(subtotal, currencyCode)}</span>
              </div>
              <p className="text-xs text-text-muted">
                Prices shown are estimates from when items were added. The exact total is confirmed at checkout.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="border border-border bg-surface px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-primary hover:border-shop-accent"
                >
                  View cart
                </Link>
                <Link
                  href="/checkout"
                  onClick={closeCart}
                  className="bg-shop-accent px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-shop-on-accent hover:bg-shop-accent-hover"
                >
                  Checkout
                </Link>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
