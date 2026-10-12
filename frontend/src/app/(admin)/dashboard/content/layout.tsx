"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";

// `match` is the path prefix that keeps a tab highlighted when its link goes to a
// sub-page (the blog section opens on its first sub-tab). SEO has its own
// sidebar entry and lives at /seo, not here.
const TABS: { label: string; href: string; permission: string; match?: string }[] = [
  { label: "Pages", href: "/dashboard/content/pages", permission: "pages.manage" },
  { label: "Homepage", href: "/dashboard/content/homepage", permission: "builder.view" },
  { label: "Blog", href: "/dashboard/content/blog/posts", permission: "blog.manage", match: "/dashboard/content/blog" },
];

/**
 * Added now that Content has its second resource (Homepage, alongside
 * Pages) — the same "tab-nav infrastructure only once 2+ tabs genuinely
 * exist" rule Purchasing/Reports already established.
 */
export default function ContentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  const visibleTabs = TABS.filter((tab) => can(user, tab.permission));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-page-title font-semibold text-text-primary">Content</h1>
        <p className="text-sm text-text-secondary">Manage static pages and the storefront homepage.</p>
      </div>

      {visibleTabs.length > 0 ? (
        <div className="border-b border-border">
          <nav aria-label="Content sections" className="flex gap-1">
            {visibleTabs.map((tab) => {
              const isActive = pathname.startsWith(tab.match ?? tab.href);
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
