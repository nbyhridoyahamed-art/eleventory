"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";

const TABS = [
  { label: "Orders", href: "/dashboard/orders/orders", permission: "orders.view" },
  { label: "Customers", href: "/dashboard/orders/customers", permission: "customers.view" },
  { label: "Returns", href: "/dashboard/orders/returns", permission: "returns.view" },
  { label: "Coupons", href: "/dashboard/orders/coupons", permission: "coupons.view" },
];

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();

  const visibleTabs = TABS.filter((tab) => can(user, tab.permission));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-page-title font-semibold text-text-primary">Orders</h1>
        <p className="text-sm text-text-secondary">Take orders from customers and track them through fulfilment.</p>
      </div>

      {visibleTabs.length > 0 ? (
        <div className="border-b border-border">
          <nav aria-label="Order sections" className="flex gap-1">
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
