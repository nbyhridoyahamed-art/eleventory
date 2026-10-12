"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";

const TABS = [
  { label: "Stock Levels", href: "/dashboard/inventory/stock-levels", permission: "inventory.view" },
  { label: "Movements", href: "/dashboard/inventory/movements", permission: "inventory.view" },
  { label: "Transfers", href: "/dashboard/inventory/transfers", permission: "inventory.transfer" },
  { label: "Stocktakes", href: "/dashboard/inventory/stocktakes", permission: "inventory.view" },
  { label: "Warehouses", href: "/dashboard/inventory/warehouses", permission: "warehouses.view" },
];

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  const visibleTabs = TABS.filter((tab) => can(user, tab.permission));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title font-semibold text-text-primary">Inventory</h1>
        <p className="text-sm text-text-secondary">Track stock levels, movements, and warehouse transfers.</p>
      </div>

      {visibleTabs.length > 0 ? (
        <div className="border-b border-border">
          <nav aria-label="Inventory sections" className="flex gap-1">
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
