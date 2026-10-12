"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";

const TABS = [
  { label: "Overview", href: "/dashboard/analytics/overview", permission: "analytics.view" },
  { label: "Products", href: "/dashboard/analytics/products", permission: "analytics.view" },
  { label: "Searches", href: "/dashboard/analytics/searches", permission: "analytics.view" },
  { label: "Funnel", href: "/dashboard/analytics/funnel", permission: "analytics.view" },
  { label: "Customers", href: "/dashboard/analytics/customers", permission: "analytics.view" },
];

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  const visibleTabs = TABS.filter((tab) => can(user, tab.permission));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title font-semibold text-text-primary">Analytics</h1>
        <p className="text-sm text-text-secondary">
          Storefront traffic, search behavior, and conversion at a glance.
        </p>
      </div>

      {visibleTabs.length > 0 ? (
        <div className="border-b border-border">
          <nav aria-label="Analytics sections" className="flex gap-1">
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
