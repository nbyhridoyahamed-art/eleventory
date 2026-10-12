"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";

const TABS = [
  { label: "Products", href: "/dashboard/catalog/products", permission: "products.view" },
  { label: "Categories", href: "/dashboard/catalog/categories", permission: "categories.view" },
  { label: "Brands", href: "/dashboard/catalog/brands", permission: "brands.view" },
  { label: "Attributes", href: "/dashboard/catalog/attributes", permission: "attributes.view" },
  { label: "Reviews", href: "/dashboard/catalog/reviews", permission: "reviews.view" },
  { label: "Media", href: "/dashboard/catalog/media", permission: "media.view" },
];

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  const visibleTabs = TABS.filter((tab) => can(user, tab.permission));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title font-semibold text-text-primary">Catalog</h1>
        <p className="text-sm text-text-secondary">Manage the products your store sells.</p>
      </div>

      {visibleTabs.length > 0 ? (
        <div className="border-b border-border">
          <nav aria-label="Catalog sections" className="flex gap-1">
            {visibleTabs.map((tab) => {
              const isActive = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-text-secondary hover:text-text-primary",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}

      {children}
    </div>
  );
}
