"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-auth";
import { NAV_ITEMS } from "@/components/layout/nav-items";

const GROUPS: Record<string, string> = {
  Dashboard: "Overview",
  Catalog: "Sell",
  Reports: "Analytics",
  Content: "Grow",
  Settings: "Manage",
};

export function SidebarNav({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  const items = NAV_ITEMS.filter(
    (item) => !item.platformOnly || user?.roles?.includes("Platform Admin"),
  ).filter(
    (item) =>
      !item.anyPermission ||
      item.anyPermission.some((p) => user?.permissions?.includes(p)),
  );

  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item, index) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href.split("/").slice(0, 3).join("/"));
        const Icon = item.icon;

        return (
          <Fragment key={item.href}>
            {GROUPS[item.label] ? (
              collapsed ? (
                <div aria-hidden className="mx-3 my-2 h-px bg-white/10" />
              ) : (
                <p
                  className={cn(
                    "px-3 pb-1.5 text-[11px] font-semibold uppercase leading-none tracking-wider text-[var(--brand-rail-muted)]",
                    index === 0 ? "pt-0" : "pt-5",
                  )}
                >
                  {GROUPS[item.label]}
                </p>
              )
            ) : null}
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                // Sits on the dark teal rail. The active item gets a coral edge, the sale marker of the brand.
                isActive
                  ? "bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-accent)]"
                  : "text-[var(--brand-rail-muted)] hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {collapsed ? null : <span>{item.label}</span>}
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
