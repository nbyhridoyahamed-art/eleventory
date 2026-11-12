"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-auth";
import { NAV_ITEMS } from "@/components/layout/nav-items";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  const items = NAV_ITEMS.filter((item) => !item.platformOnly || user?.roles?.includes("Platform Admin")).filter(
    (item) => !item.anyPermission || item.anyPermission.some((p) => user?.permissions?.includes(p)),
  );

  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href.split("/").slice(0, 3).join("/"));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              // Sits on the dark teal rail. The active item gets a coral edge, the sale marker of the brand.
              isActive
                ? "bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-accent)]"
                : "text-[var(--brand-rail-muted)] hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
