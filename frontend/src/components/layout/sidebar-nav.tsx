"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-auth";
import { NAV_ITEMS } from "@/components/layout/nav-items";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  const items = NAV_ITEMS.filter(
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
              // /8, not /10: at /10 the tint (#e9effd) only gets text-primary
              // to 4.48:1 against it — just under WCAG AA's 4.5:1 floor.
              isActive
                ? "bg-primary/8 text-primary"
                : "text-text-secondary hover:bg-border/40 hover:text-text-primary",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <p className="mt-4 px-3 text-xs text-text-muted">
        More modules unlock as each build phase ships — see the development roadmap.
      </p>
    </nav>
  );
}
