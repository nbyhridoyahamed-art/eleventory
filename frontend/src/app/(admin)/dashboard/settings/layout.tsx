"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";

const TABS = [
  { label: "General", href: "/dashboard/settings/general", permission: "settings.manage" },
  { label: "Users", href: "/dashboard/settings/users", permission: "users.view" },
  { label: "Roles", href: "/dashboard/settings/roles", permission: "roles.view" },
  { label: "Notifications", href: "/dashboard/settings/notifications", permission: "settings.manage" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  const visibleTabs = TABS.filter((tab) => can(user, tab.permission));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title font-semibold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary">Manage your store, staff, and access control.</p>
      </div>

      {visibleTabs.length > 0 ? (
        <div className="border-b border-border">
          <nav aria-label="Settings sections" className="flex gap-1">
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
