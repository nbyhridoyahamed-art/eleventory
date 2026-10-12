"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", href: "/dashboard/seo/overview" },
  { label: "Site & Homepage", href: "/dashboard/seo/site" },
  { label: "Technical", href: "/dashboard/seo/technical" },
  { label: "Integrations", href: "/dashboard/seo/integrations" },
  { label: "Redirects", href: "/dashboard/seo/redirects" },
  { label: "SEO Templates", href: "/dashboard/seo/templates" },
  { label: "404 Monitor", href: "/dashboard/seo/404-monitor" },
  { label: "Tools", href: "/dashboard/seo/tools" },
];

/** seo.manage is a single umbrella permission that also gates the sidebar entry, so no per-tab permission filtering is needed. */
export default function SeoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-page-title font-semibold text-text-primary">SEO</h1>
        <p className="text-sm text-text-secondary">
          Optimise how the store appears in search engines: content titles and descriptions, sitemap, robots.txt,
          structured data and analytics.
        </p>
      </div>

      <nav aria-label="SEO sections" className="flex flex-wrap gap-1 border-b border-border pb-3">
        {TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive ? "bg-surface-secondary text-text-primary" : "text-text-secondary hover:text-text-primary",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
