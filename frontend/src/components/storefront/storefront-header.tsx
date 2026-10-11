"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Headset, Menu, ShoppingCart, User } from "lucide-react";

import { cn } from "@/lib/utils";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CategoryMegaMenu } from "@/components/storefront/category-mega-menu";
import { HeaderSearch } from "@/components/storefront/header-search";
import { useStorefrontCategories, useStorefrontStore } from "@/hooks/use-storefront-catalog";
import { useCustomerAuthToken } from "@/lib/customer-auth-token";
import { STOREFRONT_CONTACT } from "@/lib/storefront-contact";
import { useCartStore } from "@/stores/cart-store";

const TOP_LINKS = [
  { href: "/pages/about-us", label: "About Us" },
  { href: "/blog", label: "Blog" },
  { href: "/pages/contact-us", label: "Contact Us" },
  { href: "/pages/faq", label: "FAQs" },
] as const;

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop" },
  { href: "/brands", label: "Brands" },
  { href: "/products?sort=newest", label: "New Arrivals" },
  { href: "/blog", label: "Blog" },
] as const;

function Logo({ name }: { name: string }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2 text-shop-on-nav" aria-label={`${name} home`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-shop-accent text-lg font-bold text-shop-on-accent">
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="truncate text-base font-bold tracking-tight tablet:text-xl">{name}</span>
    </Link>
  );
}

export function StorefrontHeader() {
  const { data: store } = useStorefrontStore();
  const { data: categories } = useStorefrontCategories();
  const { items, openCart } = useCartStore();
  const customerToken = useCustomerAuthToken();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapseSearch, setCollapseSearch] = useState(false);

  // Phone: once you have scrolled down, drop the search row to keep the sticky header slim.
  // Two thresholds (hysteresis) so the header height changing never flickers it back and forth.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setCollapseSearch((current) => (current ? y > 40 : y > 140));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const storeName = store?.name ?? "Store";

  // Live suggestions, keyboard navigation and submit all live in HeaderSearch.
  const searchForm = <HeaderSearch categories={categories ?? []} />;

  return (
    // Desktop: the top strip (h-9) scrolls away while the rest sticks. Phone: the search row collapses on scroll.
    <header className="sticky top-0 z-40 desktop:-top-9">
      {/* Top strip */}
      <div className="hidden h-9 bg-shop-nav text-xs text-shop-on-nav desktop:block">
        <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between border-b border-white/10 px-4">
          <p>
            Cash on Delivery nationwide · Easy 7-day returns.{" "}
            <Link href="/products?sale=1" className="font-semibold underline underline-offset-2">
              SHOP NOW
            </Link>
          </p>
          <nav aria-label="Top links" className="flex items-center gap-5">
            {TOP_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Main bar */}
      <div className="bg-shop-nav text-shop-on-nav">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 desktop:gap-8">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b border-border p-4">
                <SheetTitle>{storeName}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileNavOpen(false)}
                    className="rounded-md px-2 py-2 text-sm font-medium hover:bg-border/30"
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href="/products?sale=1"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-md px-2 py-2 text-sm font-medium hover:bg-border/30"
                >
                  Today&apos;s Deals
                </Link>
                {categories && categories.length > 0 ? (
                  <>
                    <p className="mt-3 px-2 text-xs font-semibold uppercase text-text-muted">Categories</p>
                    {categories.map((category) => (
                      <Link
                        key={category.id}
                        href={`/category/${category.slug}`}
                        onClick={() => setMobileNavOpen(false)}
                        className="rounded-md px-2 py-2 text-sm hover:bg-border/30"
                      >
                        {category.name}
                      </Link>
                    ))}
                  </>
                ) : null}
              </nav>
            </SheetContent>

            <button
              type="button"
              className="flex size-10 shrink-0 items-center justify-center desktop:hidden"
              aria-label="Open menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu />
            </button>
          </Sheet>

          <Logo name={storeName} />

          <div className="hidden min-w-0 flex-1 desktop:flex">{searchForm}</div>

          <div className="ml-auto flex shrink-0 items-center gap-2 desktop:ml-0 desktop:gap-6">
            <a
              href={STOREFRONT_CONTACT.phoneHref}
              className="hidden items-center gap-2 text-left desktop:flex"
              aria-label={`Call ${STOREFRONT_CONTACT.phone}`}
            >
              <Headset className="size-7" />
              <span className="text-xs leading-tight">
                <span className="block text-shop-on-nav-muted">Call Now:</span>
                <span className="font-semibold">{STOREFRONT_CONTACT.phone}</span>
              </span>
            </a>

            <Link
              href="/account"
              className="flex size-10 items-center justify-center"
              aria-label={customerToken ? "My account" : "Sign in"}
            >
              <User />
            </Link>

            <button
              type="button"
              className="relative flex size-10 items-center justify-center"
              aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}
              onClick={openCart}
            >
              <ShoppingCart />
              {itemCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-shop-accent text-[10px] font-bold text-shop-on-accent">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Mobile / tablet search */}
        <div className={cn("px-4 pb-3 desktop:hidden", collapseSearch && "hidden")}>{searchForm}</div>
      </div>

      {/* Navigation bar */}
      <div className="hidden bg-shop-accent text-shop-on-accent desktop:block">
        <div className="mx-auto flex max-w-[1400px] items-center gap-8 px-4">
          <div className="my-1.5">
            <CategoryMegaMenu
              label="SHOP BY CATEGORIES"
              showMenuIcon
              triggerClassName="h-10 w-64 bg-white px-4 text-xs font-semibold uppercase tracking-wide text-shop-on-accent hover:bg-white/90"
            />
          </div>
          <nav aria-label="Main" className="flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} href={link.href} className="py-3 text-sm font-medium hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
          <Link href="/products?sale=1" className="ml-auto py-3 text-sm font-semibold hover:underline">
            Today&apos;s Deals
          </Link>
        </div>
      </div>
    </header>
  );
}
