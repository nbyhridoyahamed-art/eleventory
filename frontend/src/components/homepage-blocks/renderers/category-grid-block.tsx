import Link from "next/link";
import { Package } from "lucide-react";

import { SectionHeading } from "@/components/homepage-blocks/section-heading";
import type { AutoManualCategorySettings } from "@/types/homepage-block";
import type { StorefrontCategory } from "@/types/storefront";

/** Featured categories as a compact tile grid: a small picture over the name. Columns follow the block's own width. */
export function CategoryGridBlock({ settings, categories }: { settings: AutoManualCategorySettings; categories: StorefrontCategory[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="@container space-y-4">
      <SectionHeading title={settings.heading} />
      <div className="grid grid-cols-3 border-l border-t border-border bg-surface @xl:grid-cols-4 @4xl:grid-cols-8">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            className="group flex flex-col items-center gap-3 border-b border-r border-border px-2 py-5 text-center transition-colors hover:bg-shop-tint"
          >
            <span className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-white p-1.5 ring-1 ring-border">
              {category.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
                <img
                  src={category.image_url}
                  alt=""
                  className="max-h-full max-w-full object-contain transition-transform group-hover:scale-110"
                />
              ) : (
                <Package className="size-6 text-text-muted" />
              )}
            </span>
            <span className="line-clamp-2 text-xs font-medium leading-snug text-text-primary">{category.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
