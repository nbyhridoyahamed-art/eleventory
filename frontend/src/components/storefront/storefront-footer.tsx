"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import { useStorefrontStore } from "@/hooks/use-storefront-catalog";
import { useNewsletterSubscribe } from "@/hooks/use-storefront-homepage";
import { useStorefrontPages } from "@/hooks/use-storefront-pages";
import { STOREFRONT_CONTACT } from "@/lib/storefront-contact";

type FooterLink = { label: string; href: string };

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  if (links.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-shop-on-nav">{title}</h3>
      <ul className="space-y-2.5 text-sm text-shop-on-nav-muted">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="hover:text-shop-on-nav hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StorefrontFooter() {
  const { data: store } = useStorefrontStore();
  const { data: pages } = useStorefrontPages();
  const subscribe = useNewsletterSubscribe();
  const [email, setEmail] = useState("");

  const storeName = store?.name ?? "Store";
  const published = new Set((pages ?? []).map((page) => page.slug));

  // Only link CMS pages that actually exist, so the footer never points at a 404.
  const pageLinks = (items: [slug: string, label: string][]): FooterLink[] =>
    items.filter(([slug]) => published.has(slug)).map(([slug, label]) => ({ label, href: `/pages/${slug}` }));

  const productLinks: FooterLink[] = [
    { label: "Prices Drop", href: "/products?sale=1" },
    { label: "New Products", href: "/products?sort=newest" },
    { label: "Best Sales", href: "/products?featured=1" },
    { label: "Brands", href: "/brands" },
    ...pageLinks([["contact-us", "Contact Us"]]),
  ];

  const companyLinks: FooterLink[] = [
    ...pageLinks([
      ["shipping-policy", "Delivery"],
      ["privacy-policy", "Privacy Policy"],
      ["terms-conditions", "Terms and Conditions"],
      ["about-us", "About Us"],
      ["return-refund-policy", "Return & Refund Policy"],
      ["affiliate-policy", "Affiliate"],
    ]),
  ];

  const accountLinks: FooterLink[] = [
    { label: "My Account", href: "/account" },
    { label: "Cart", href: "/cart" },
    { label: "Checkout", href: "/checkout" },
    ...pageLinks([
      ["track-order", "Order Tracking"],
      ["faq", "FAQ"],
    ]),
  ];

  return (
    <footer className="mt-auto pb-14 desktop:pb-0">
      {/* Newsletter band */}
      <section className="bg-shop-accent text-shop-on-accent">
        <div className="mx-auto grid max-w-[1400px] items-center gap-4 px-4 py-8 desktop:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold tablet:text-2xl">Sign Up &amp; Subscribe To Our Newsletter</h2>
            <p className="mt-1 text-xs">Subscribe to our latest newsletter to get news about special discounts and upcoming sales</p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              subscribe.mutate(email, { onSuccess: () => setEmail("") });
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              aria-label="Email address"
              className="h-11 min-w-0 flex-1 border border-transparent bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-shop-nav"
            />
            <button
              type="submit"
              disabled={subscribe.isPending}
              className="h-11 shrink-0 bg-shop-nav px-5 text-xs font-semibold uppercase tracking-wide text-shop-on-nav transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {subscribe.isPending ? "Subscribing…" : "Subscribe"}
            </button>
          </form>
        </div>
      </section>

      {/* Link columns */}
      <section className="bg-shop-nav text-shop-on-nav">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-12 tablet:grid-cols-2 desktop:grid-cols-[1.3fr_1fr_1fr_1fr_1.3fr]">
          <div className="space-y-4">
            <h3 className="text-base font-semibold">About Our Store</h3>
            <p className="max-w-xs text-sm leading-relaxed text-shop-on-nav-muted">
              Welcome to {storeName}. We pride ourselves on genuine products, fair prices and dependable delivery
              across Bangladesh, with Cash on Delivery so you only pay when you are happy.
            </p>
          </div>

          <FooterColumn title="Products" links={productLinks} />
          <FooterColumn title="Our Company" links={companyLinks} />
          <FooterColumn title="Your Account" links={accountLinks} />

          <div className="space-y-4">
            <h3 className="text-base font-semibold">Contact Us</h3>
            <ul className="space-y-3 text-sm text-shop-on-nav-muted">
              <li className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {STOREFRONT_CONTACT.address}
              </li>
              <li className="flex gap-2">
                <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  <a href={STOREFRONT_CONTACT.phoneHref} className="hover:text-shop-on-nav hover:underline">
                    {STOREFRONT_CONTACT.phone}
                  </a>
                  <span className="block text-xs">{STOREFRONT_CONTACT.hours}</span>
                </span>
              </li>
              <li className="flex gap-2">
                <Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <a href={`mailto:${STOREFRONT_CONTACT.email}`} className="hover:text-shop-on-nav hover:underline">
                  {STOREFRONT_CONTACT.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/15">
          <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-shop-on-nav-muted tablet:flex-row">
            <p>
              &copy; {new Date().getFullYear()} {storeName}. All rights reserved.
            </p>
            <p>Cash on Delivery available nationwide</p>
          </div>
        </div>
      </section>
    </footer>
  );
}
