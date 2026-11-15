"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/homepage-blocks/section-heading";
import { ShopProductCard } from "@/components/storefront/shop-product-card";
import type { ProductCarouselSettings } from "@/types/homepage-block";
import type { StorefrontProduct } from "@/types/storefront";

const AUTOPLAY_MS = 5000;

/**
 * A product slider: snap-aligned cards in the same bordered grid look as the tabs row, arrow buttons that
 * disable at the ends, and a slow auto-advance that pauses on hover or focus, wraps back to the start, and
 * is skipped entirely when the visitor prefers reduced motion. Cards per view follow the block's own width.
 */
export function ProductCarouselBlock({ settings, products }: { settings: Pick<ProductCarouselSettings, "heading">; products: StorefrontProduct[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    setEdges({
      start: node.scrollLeft <= 2,
      end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 2,
    });
  }, []);

  const slide = useCallback((direction: 1 | -1) => {
    const node = scroller.current;
    if (!node) return;

    if (direction === 1 && node.scrollLeft + node.clientWidth >= node.scrollWidth - 2) {
      node.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    node.scrollBy({ left: direction * node.clientWidth * 0.8, behavior: "smooth" });
  }, []);

  useEffect(() => {
    measure();
    const node = scroller.current;
    if (!node) return;

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = reduced ? null : window.setInterval(() => {
      if (!paused.current && !document.hidden) slide(1);
    }, AUTOPLAY_MS);

    return () => {
      observer.disconnect();
      if (timer) window.clearInterval(timer);
    };
  }, [measure, slide, products.length]);

  if (products.length === 0) return null;

  const arrow = "flex size-8 items-center justify-center rounded-full bg-shop-nav text-shop-on-nav transition-opacity hover:opacity-90 disabled:opacity-30";

  return (
    <section
      className="@container space-y-4"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
    >
      <SectionHeading title={settings.heading}>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous products" disabled={edges.start} onClick={() => slide(-1)} className={arrow}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Next products" onClick={() => slide(1)} className={arrow}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      </SectionHeading>

      <div
        ref={scroller}
        onScroll={measure}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth border-l border-t border-border [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden hb-stagger"
      >
        {products.map((product) => (
          <div
            key={product.id}
            className={cn("w-1/2 shrink-0 snap-start border-b border-r border-border @xl:w-1/3 @3xl:w-1/4 @5xl:w-1/5")}
          >
            <ShopProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
