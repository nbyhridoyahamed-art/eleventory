import Link from "next/link";
import { BarChart3, Boxes, Check, Globe, LayoutTemplate, Package, ShoppingCart, Truck } from "lucide-react";

import { Logo } from "@/components/shared/logo";

export const metadata = {
  title: "Open your online store",
  description: "Sign up, add your products and start taking cash-on-delivery orders on your own address.",
};

const FEATURES = [
  { icon: Package, title: "Catalog and inventory", text: "Products, variants, bundles and stock across warehouses, with low-stock alerts." },
  { icon: ShoppingCart, title: "Orders and cash on delivery", text: "Process, ship and settle COD orders, handle returns and keep every status in one place." },
  { icon: Truck, title: "Couriers and delivery zones", text: "Book shipments with your courier and set delivery rates by zone and order value." },
  { icon: Globe, title: "Your own address", text: "Start on a free subdomain, then connect your own domain with HTTPS handled for you." },
  { icon: LayoutTemplate, title: "Themes and homepage builder", text: "Pick a look, set your colours and logo, and arrange your homepage with blocks." },
  { icon: BarChart3, title: "Reports and SEO", text: "Sales, stock and customer reports, plus search tools that help shoppers find you." },
];

const STEPS = [
  { title: "Create your account", text: "Pick a store name and address, confirm your email, and your store is created with sensible defaults." },
  { title: "Add products and delivery", text: "Follow the checklist: your first product, delivery zones and rates, and how you want to be paid." },
  { title: "Share your address", text: "Your store is live on its own address. Connect a custom domain whenever you are ready." },
];

// Prices and limits are placeholders until the plans are confirmed (SAAS_PLAN.md section 5).
const PLANS = [
  { name: "Starter", blurb: "For a new shop finding its feet", items: ["Up to [X] products", "[X] staff accounts", "Free subdomain", "Cash on delivery"], popular: false },
  { name: "Growth", blurb: "For shops with steady orders", items: ["Up to [X] products", "[X] staff accounts", "Custom domain with HTTPS", "Online payments (bKash, SSLCommerz)"], popular: true },
  { name: "Pro", blurb: "For high-volume and multi-store sellers", items: ["Up to [X] products", "[X] staff accounts and stores", "Multiple custom domains", "Priority support"], popular: false },
];

export default function PlatformLandingPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4 lg:px-16">
        <Logo />
        <nav className="flex gap-7 text-sm text-text-secondary">
          <a href="#features" className="hover:text-text-primary">Features</a>
          <a href="#how" className="hover:text-text-primary">How it works</a>
          <a href="#pricing" className="hover:text-text-primary">Pricing</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-3 py-2 text-sm font-medium">Sign in</Link>
          <Link href="/signup" className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
            Start free trial
          </Link>
        </div>
      </header>

      <section className="grid items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:px-16 lg:py-24">
        <div className="space-y-6">
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            Built for sellers in Bangladesh
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight lg:text-6xl">
            Your own online store, open this week.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-text-secondary">
            Sign up, add your products and start taking cash-on-delivery orders on your own address. Inventory,
            couriers and reports are already built in.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/signup" className="rounded-lg bg-primary px-7 py-3.5 text-base font-semibold text-white hover:opacity-90">
              Start your free trial
            </Link>
            <a href="#pricing" className="rounded-lg border border-border bg-surface px-6 py-3.5 text-base font-semibold">
              See pricing
            </a>
          </div>
          <p className="text-sm text-text-muted">14-day free trial. No card needed to start.</p>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-xl">
          <div className="flex items-center justify-between text-sm">
            <strong>Rahim Gadgets</strong>
            <span className="text-xs text-text-muted">rahim-gadgets.[your-domain]</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[["Orders today", "24"], ["Pending", "7"], ["Low stock", "3"]].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border p-3.5">
                <div className="text-xs text-text-secondary">{label}</div>
                <div className="mt-1 text-2xl font-bold">{value}</div>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border border-border text-sm">
            <div className="flex justify-between bg-background px-3.5 py-3 font-semibold"><span>Order</span><span>Status</span></div>
            {[["#1042 · Karim", "Processing", "text-info"], ["#1041 · Nusrat", "Shipped", "text-warning"], ["#1040 · Tanvir", "Delivered", "text-success"]].map(([o, s, c]) => (
              <div key={o} className="flex justify-between border-t border-border px-3.5 py-3">
                <span>{o}</span><span className={`font-semibold ${c}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 pb-14 text-sm font-semibold text-text-secondary">
        <span className="font-medium text-text-muted">Works with</span>
        <span>Cash on delivery</span><span>bKash</span><span>Nagad</span><span>SSLCommerz</span><span>Steadfast courier</span>
      </section>

      <section id="features" className="space-y-10 border-y border-border bg-surface px-6 py-16 lg:px-16">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-3xl font-bold tracking-tight">Everything a shop needs, nothing to install</h2>
          <p className="text-lg text-text-secondary">The same tools that run a busy store today, ready the moment you sign up.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="space-y-2.5 rounded-xl border border-border p-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></span>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-sm leading-relaxed text-text-secondary">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="space-y-10 px-6 py-16 lg:px-16">
        <h2 className="text-3xl font-bold tracking-tight">Open your store in three steps</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="space-y-2.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary font-bold text-white">{i + 1}</span>
              <h3 className="text-xl font-semibold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-text-secondary">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="space-y-10 border-t border-border bg-surface px-6 py-16 lg:px-16">
        <div className="space-y-3 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Simple plans that grow with you</h2>
          <p className="text-lg text-text-secondary">Every plan starts with a 14-day free trial. Prices and limits are placeholders until plans are confirmed.</p>
        </div>
        <div className="grid items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col gap-5 rounded-2xl p-8 ${plan.popular ? "border-2 border-primary shadow-xl" : "border border-border"}`}
            >
              {plan.popular ? (
                <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">Most popular</span>
              ) : null}
              <div>
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="mt-1.5 text-sm text-text-muted">{plan.blurb}</p>
              </div>
              <div className="text-4xl font-bold">৳[PRICE]<span className="text-base font-medium text-text-muted"> / month</span></div>
              <ul className="space-y-3 text-sm">
                {plan.items.map((item) => (
                  <li key={item} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" />{item}</li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-auto rounded-lg py-3 text-center text-sm font-semibold ${plan.popular ? "bg-primary text-white" : "border border-border"}`}
              >
                Start free trial
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-5 bg-slate-900 px-6 py-16 text-center text-slate-50">
        <h2 className="text-3xl font-bold tracking-tight">Ready to open your store?</h2>
        <p className="text-lg text-slate-300">Create your account in a minute. Your trial starts today.</p>
        <Link href="/signup" className="inline-block rounded-lg bg-white px-7 py-3.5 text-base font-semibold text-slate-900">
          Start your free trial
        </Link>
      </section>

      <footer className="flex flex-wrap justify-between gap-4 border-t border-border bg-surface px-6 py-8 text-sm text-text-muted lg:px-16">
        <span>© Eleventory</span>
        <span className="flex gap-6"><span>Terms</span><span>Privacy</span><span>Support</span></span>
      </footer>
    </div>
  );
}
