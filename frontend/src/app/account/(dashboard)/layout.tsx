"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, MapPin, Package, Star, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCustomerAuthToken } from "@/lib/customer-auth-token";
import { PageBanner } from "@/components/storefront/page-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentCustomer, useCustomerLogout } from "@/hooks/use-customer-auth";

const NAV_ITEMS = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/reviews", label: "Reviews", icon: Star },
  { href: "/account/profile", label: "Profile", icon: User },
] as const;

function AuthGateSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-3 px-4 py-8">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export default function AccountDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const token = useCustomerAuthToken();
  const { data: customer, isLoading, isError } = useCurrentCustomer();
  const logout = useCustomerLogout();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (!token || isError)) {
      router.replace("/account/login");
    }
  }, [mounted, token, isError, router]);

  if (!mounted || !token || isLoading) {
    return <AuthGateSkeleton />;
  }

  const isActive = (href: string) => (href === "/account" ? pathname === "/account" : pathname.startsWith(href));
  const current = NAV_ITEMS.find((item) => isActive(item.href));
  const crumbs =
    current && current.href !== "/account"
      ? [{ label: "Home", href: "/" }, { label: "My Account", href: "/account" }, { label: current.label }]
      : [{ label: "Home", href: "/" }, { label: "My Account" }];

  return (
    <div>
      <PageBanner title="My Account" crumbs={crumbs} />

      <div className="mx-auto max-w-[1400px] px-4 py-8">
        <div className="grid grid-cols-1 gap-6 desktop:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-4 self-start">
            {customer ? (
              <div className="flex items-center gap-3 border border-border bg-surface p-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-shop-nav text-lg font-bold text-shop-on-nav">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{customer.name}</p>
                  <p className="truncate text-xs text-text-muted">{customer.phone}</p>
                </div>
              </div>
            ) : null}

            <nav
              aria-label="Account"
              className="flex gap-1 overflow-x-auto border border-border bg-surface p-1 desktop:flex-col desktop:gap-0 desktop:overflow-visible desktop:p-0"
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors desktop:border-b desktop:border-l-4 desktop:border-border",
                      active
                        ? "bg-shop-tint text-text-primary desktop:border-l-shop-accent"
                        : "text-text-secondary hover:bg-shop-tint hover:text-text-primary desktop:border-l-transparent",
                    )}
                  >
                    <Icon className={cn("size-4", active && "text-shop-ink")} />
                    {item.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => logout.mutate()}
                className="flex shrink-0 items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/5 desktop:border-l-4 desktop:border-l-transparent"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </nav>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
