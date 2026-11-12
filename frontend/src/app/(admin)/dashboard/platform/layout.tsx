"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-auth";
import { PermissionDenied } from "@/components/permission-denied";

const TABS = [
  { label: "Overview", href: "/dashboard/platform" },
  { label: "Tenants", href: "/dashboard/platform/tenants" },
  { label: "Reports", href: "/dashboard/platform/reports" },
  { label: "Announcements", href: "/dashboard/platform/announcements" },
  { label: "Audit log", href: "/dashboard/platform/audit" },
];

/** The platform area: only people with the Platform Admin role see it (the API enforces it too). */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  if (user && !user.roles?.includes("Platform Admin")) return <PermissionDenied />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title font-semibold text-text-primary">Platform</h1>
        <p className="text-sm text-text-secondary">Every shop on Eleventory. Changes here are recorded in the audit log.</p>
      </div>

      <div className="border-b border-border">
        <nav aria-label="Platform sections" className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = tab.href === "/dashboard/platform" ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
