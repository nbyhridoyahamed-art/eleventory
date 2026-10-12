"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, LogOut, Menu, Moon, Sun, User as UserIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Logo } from "@/components/shared/logo";
import { useLogout } from "@/hooks/use-auth";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/use-notifications";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { timeAgo } from "@/lib/utils";
import type { User } from "@/types/auth";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const SEGMENT_LABELS: Record<string, string> = {
  general: "General",
  users: "Users",
  roles: "Roles",
  products: "Products",
  categories: "Categories",
  brands: "Brands",
  new: "New",
  "stock-levels": "Stock Levels",
  movements: "Movements",
  transfers: "Transfers",
  warehouses: "Warehouses",
  "purchase-orders": "Purchase Orders",
  suppliers: "Suppliers",
};

function getBreadcrumb(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return ["Dashboard"];

  const [root, ...rest] = segments;
  const rootItem = NAV_ITEMS.find((item) => item.href.split("/")[1] === root);
  const crumbs = [rootItem?.label ?? root];

  for (const segment of rest) {
    if (/^\d+$/.test(segment)) {
      crumbs.push("Edit");
    } else {
      crumbs.push(SEGMENT_LABELS[segment] ?? segment);
    }
  }

  return crumbs;
}

export function AdminTopbar({ user }: { user?: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const logout = useLogout();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { data: notifications, isLoading: notificationsLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const breadcrumb = getBreadcrumb(pathname);
  const unreadCount = notifications?.meta?.unread_count ?? 0;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b border-border p-4">
              <SheetTitle asChild>
                <Logo />
              </SheetTitle>
            </SheetHeader>
            <div className="py-4">
              <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-text-secondary">
          {breadcrumb.map((crumb, index) => (
            <span key={index} className="flex items-center gap-1.5">
              {index > 0 ? <span className="text-text-muted">/</span> : null}
              <span
                className={index === breadcrumb.length - 1 ? "font-medium text-text-primary" : undefined}
              >
                {crumb}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
              {unreadCount > 0 ? (
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => markAllRead.mutate()}
                >
                  Mark all read
                </Button>
              ) : null}
            </div>
            <DropdownMenuSeparator />
            {notificationsLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !notifications || notifications.data.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-text-muted">No notifications yet.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifications.data.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="flex flex-col items-start gap-0.5 whitespace-normal"
                    onSelect={() => {
                      if (!notification.read_at) markRead.mutate(notification.id);
                      router.push(`/orders/orders/${notification.data.order_id}`);
                    }}
                  >
                    <div className="flex w-full items-center gap-1.5">
                      {!notification.read_at ? <span className="size-1.5 shrink-0 rounded-full bg-primary" /> : null}
                      <span className="text-sm font-medium text-text-primary">New order placed</span>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {notification.data.order_number} from {notification.data.customer_name}
                    </p>
                    <p className="text-xs text-text-muted">{timeAgo(notification.created_at)}</p>
                  </DropdownMenuItem>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Profile menu" className="rounded-full">
              <Avatar>
                <AvatarFallback>{user ? initials(user.name) : <UserIcon className="size-4" />}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-text-primary">{user?.name}</span>
              <span className="text-xs text-text-muted">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout.mutate()} className="text-danger">
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
