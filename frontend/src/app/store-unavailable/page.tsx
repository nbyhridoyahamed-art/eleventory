import { brandFontClasses } from "@/lib/brand-fonts";
import { BrandSurface } from "@/components/shared/brand-surface";
import Link from "next/link";
import { Store } from "lucide-react";

import { Logo } from "@/components/shared/logo";

export const metadata = { title: "Store unavailable", robots: { index: false, follow: false } };

/** Shown for a store that is suspended, closed or cannot be found. */
export default function StoreUnavailablePage() {
  return (
    <BrandSurface fontClassName={brandFontClasses} className="flex flex-col">
      <header className="px-6 py-5 lg:px-16">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-border/50 text-text-secondary">
            <Store className="size-7" aria-hidden="true" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight">This store is not available right now</h1>
          <p className="leading-relaxed text-text-secondary">
            The shop you are looking for is closed or temporarily offline. If you were trying to place an order, please
            try again later or contact the shop directly.
          </p>
          <Link href="/platform" className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:opacity-90">
            Visit Eleventory
          </Link>
          <p className="text-xs text-text-muted">Are you the owner? Sign in to check your store status.</p>
        </div>
      </main>
    </BrandSurface>
  );
}
