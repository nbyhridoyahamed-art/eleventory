"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/homepage-blocks/section-heading";
import { ShopProductCard } from "@/components/storefront/shop-product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStorefrontProducts, type StorefrontProductFilters } from "@/hooks/use-storefront-catalog";
import type { ProductTab, ProductTabsSettings } from "@/types/homepage-block";

function filtersFor(tab: ProductTab, limit: number): StorefrontProductFilters {
  const base: StorefrontProductFilters = { inStock: true, perPage: limit };

  switch (tab.source) {
    case "sale":
      return { ...base, onSale: true };
    case "featured":
      return { ...base, featured: true };
    case "category":
      return { ...base, category: tab.category_slug ?? undefined, sort: "newest" };
    case "brand":
      return { ...base, brand: tab.brand_slug ?? undefined, sort: "newest" };
    default:
      return { ...base, sort: "newest" };
  }
}

/**
 * A titled product row with filter tabs and scroll arrows. Unlike the
 * auto/manual blocks, each tab queries the public product list itself (by
 * category/brand slug, sale, newest...) instead of getting rows resolved
 * server-side, since switching tabs is a client-side interaction. Cards per
 * row follow the block's own width (container queries), so the builder's
 * narrow canvas gets two cards across, not five slivers.
 */
export function ProductTabsBlock({ settings }: { settings: ProductTabsSettings }) {
  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  const tab = settings.tabs[Math.min(active, settings.tabs.length - 1)];
  const { data, isLoading } = useStorefrontProducts(tab ? filtersFor(tab, settings.limit) : {});
  const products = data?.data ?? [];

  if (settings.tabs.length === 0) return null;

  function scrollRow(direction: 1 | -1) {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: direction * node.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section className="@container space-y-4">
      <SectionHeading title={settings.heading}>
        <div className="flex items-center gap-2">
          {settings.view_all_url ? (
            <Link href={settings.view_all_url} className="mr-2 text-sm font-medium text-shop-ink hover:underline">
              View all
            </Link>
          ) : null}
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollRow(-1)}
            className="flex size-8 items-center justify-center rounded-full bg-shop-nav text-shop-on-nav hover:opacity-90"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollRow(1)}
            className="flex size-8 items-center justify-center rounded-full bg-shop-nav text-shop-on-nav hover:opacity-90"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </SectionHeading>

      {settings.tabs.length > 1 ? (
        <div role="tablist" className="flex gap-2 overflow-x-auto pb-1">
          {settings.tabs.map((item, index) => (
            <button
              key={`${item.label}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === active}
              onClick={() => setActive(index)}
              className={cn(
                "shrink-0 border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                index === active
                  ? "border-shop-accent bg-shop-accent text-shop-on-accent"
                  : "border-border bg-surface text-text-secondary hover:border-shop-accent hover:text-text-primary",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-px bg-border @xl:grid-cols-3 @5xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[3/4] w-full rounded-none" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="border border-border bg-surface px-4 py-10 text-center text-sm text-text-secondary">
          Nothing to show here yet.
        </p>
      ) : (
        <div
          ref={scroller}
          className="flex snap-x snap-mandatory overflow-x-auto border-l border-t border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="w-1/2 shrink-0 snap-start border-b border-r border-border @xl:w-1/3 @3xl:w-1/4 @5xl:w-1/5"
            >
              <ShopProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
