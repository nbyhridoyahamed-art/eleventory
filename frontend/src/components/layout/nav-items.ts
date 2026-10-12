import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Boxes,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Package,
  SearchCheck,
  Settings,
  ShoppingCart,
  TrendingUp,
  Truck,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown to everyone when omitted; otherwise requires at least one of these permissions. */
  anyPermission?: string[];
}

/**
 * Only routes that are actually implemented belong here (spec rule 178:
 * no dead links). New entries are added the moment their phase ships —
 * see PAGE_INVENTORY.md for what's next.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Catalog",
    href: "/dashboard/catalog/products",
    icon: Package,
    anyPermission: ["products.view", "categories.view", "brands.view", "attributes.view"],
  },
  {
    label: "Inventory",
    href: "/dashboard/inventory/stock-levels",
    icon: Boxes,
    anyPermission: ["inventory.view", "inventory.transfer", "warehouses.view"],
  },
  {
    label: "Purchasing",
    href: "/dashboard/purchasing/purchase-orders",
    icon: ClipboardList,
    anyPermission: ["purchase_orders.view", "suppliers.view"],
  },
  {
    label: "Orders",
    href: "/dashboard/orders/orders",
    icon: ShoppingCart,
    anyPermission: ["orders.view", "customers.view", "returns.view"],
  },
  {
    label: "Delivery",
    href: "/dashboard/delivery/shipments",
    icon: Truck,
    anyPermission: ["shipments.view", "couriers.view", "cod_settlements.view"],
  },
  {
    label: "Reports",
    href: "/dashboard/reports/sales",
    icon: BarChart3,
    anyPermission: ["reports.view"],
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics/overview",
    icon: TrendingUp,
    anyPermission: ["analytics.view"],
  },
  {
    label: "Content",
    href: "/dashboard/content/pages",
    icon: FileText,
    anyPermission: ["pages.manage", "builder.view", "blog.manage"],
  },
  {
    label: "SEO",
    href: "/dashboard/seo/overview",
    icon: SearchCheck,
    anyPermission: ["seo.manage"],
  },
  {
    label: "AI Assistant",
    href: "/dashboard/mcp",
    icon: Bot,
    anyPermission: ["settings.manage"],
  },
  {
    label: "Settings",
    href: "/dashboard/settings/general",
    icon: Settings,
    anyPermission: ["settings.manage", "users.view", "roles.view"],
  },
];
