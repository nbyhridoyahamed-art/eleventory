"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useSeoSettings, useUpdateSeoSettings } from "@/hooks/use-seo-settings";
import { PermissionDenied } from "@/components/permission-denied";
import { Field, SeoCard, ToggleRow } from "@/components/seo/seo-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { SeoSettings } from "@/types/seo-settings";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Same list the storefront's /robots.txt route disallows by default — the
// admin, account and checkout areas that should never be indexed.
const DEFAULT_DISALLOW = [
  "/dashboard",
  "/account",
  "/login",
  "/register",
  "/cart",
  "/checkout",
  "/order-confirmation",
];

const ROBOTS_MODES: { value: SeoSettings["robots"]["mode"]; label: string; hint: string }[] = [
  { value: "default", label: "Standard", hint: "Allow search engines everywhere except the admin, account, cart and checkout areas." },
  { value: "custom", label: "Custom", hint: "Write your own robots.txt for full control." },
  { value: "block_all", label: "Block everything", hint: "Ask all search engines not to index the site. Use only while the store is not ready to launch." },
];

const lines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

function TechnicalForm({ storeId, settings }: { storeId: number; settings: SeoSettings }) {
  const update = useUpdateSeoSettings(storeId);

  const [robots, setRobots] = useState({
    mode: settings.robots.mode,
    custom: settings.robots.custom ?? "",
    extra_disallow: settings.robots.extra_disallow.join("\n"),
  });
  const [sitemap, setSitemap] = useState(settings.sitemap);
  const [schema, setSchema] = useState({
    ...settings.schema,
    org_name: settings.schema.org_name ?? "",
    org_logo: settings.schema.org_logo ?? "",
    org_phone: settings.schema.org_phone ?? "",
    org_email: settings.schema.org_email ?? "",
    org_address: settings.schema.org_address ?? "",
    social_profiles: settings.schema.social_profiles.join("\n"),
  });

  const extra = lines(robots.extra_disallow);
  const sitemapLine = sitemap.enabled ? `\nSitemap: ${SITE_URL}/sitemap.xml` : "";
  const preview =
    robots.mode === "block_all"
      ? "User-agent: *\nDisallow: /"
      : robots.mode === "custom" && robots.custom.trim()
        ? `${robots.custom.trim()}${/sitemap:/i.test(robots.custom) ? "" : `\n${sitemapLine}`}`
        : `User-agent: *\nAllow: /\n${[...DEFAULT_DISALLOW, ...extra].map((path) => `Disallow: ${path}`).join("\n")}\n${sitemapLine}`;

  function save() {
    update.mutate({
      robots: { mode: robots.mode, custom: robots.custom, extra_disallow: extra },
      sitemap,
      schema: { ...schema, social_profiles: lines(schema.social_profiles) },
    });
  }

  return (
    <div className="space-y-6">
      <SeoCard
        title="robots.txt"
        description="Tells search engines which parts of the site they may crawl. The live file is served at /robots.txt."
        action={
          <a
            href="/robots.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            View live file <ExternalLink className="size-3.5" />
          </a>
        }
      >
        <div className="grid gap-2 tablet:grid-cols-3">
          {ROBOTS_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setRobots({ ...robots, mode: mode.value })}
              aria-pressed={robots.mode === mode.value}
              className={cn(
                "rounded-md border p-3 text-left transition-colors",
                robots.mode === mode.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
              )}
            >
              <span className="block text-sm font-semibold text-text-primary">{mode.label}</span>
              <span className="mt-0.5 block text-xs text-text-secondary">{mode.hint}</span>
            </button>
          ))}
        </div>

        {robots.mode === "default" ? (
          <Field
            label="Extra paths to block"
            htmlFor="robots-extra"
            hint="One path per line, each starting with a slash, e.g. /private. These are added to the standard rules."
          >
            <Textarea
              id="robots-extra"
              rows={3}
              value={robots.extra_disallow}
              placeholder={"/private\n/internal-search"}
              onChange={(event) => setRobots({ ...robots, extra_disallow: event.target.value })}
            />
          </Field>
        ) : null}

        {robots.mode === "custom" ? (
          <Field
            label="Custom robots.txt"
            htmlFor="robots-custom"
            hint="Used exactly as written. If it has no Sitemap line, one is added automatically when the sitemap is enabled."
          >
            <Textarea
              id="robots-custom"
              rows={8}
              className="font-mono text-xs"
              value={robots.custom}
              placeholder={"User-agent: *\nAllow: /\nDisallow: /cart"}
              onChange={(event) => setRobots({ ...robots, custom: event.target.value })}
            />
          </Field>
        ) : null}

        {robots.mode === "block_all" ? (
          <p className="rounded-md bg-warning/10 p-3 text-sm text-warning">
            Search engines will be asked not to index any page. Switch back to Standard before you launch, or the store
            will not appear in Google.
          </p>
        ) : null}

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">Preview</p>
          <pre className="max-h-64 overflow-auto rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-text-secondary">
            {preview.trim()}
          </pre>
        </div>
      </SeoCard>

      <SeoCard
        title="XML sitemap"
        description="A list of every public page so search engines can find new products and posts quickly. Served at /sitemap.xml and referenced from robots.txt."
        action={
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            View sitemap <ExternalLink className="size-3.5" />
          </a>
        }
      >
        <ToggleRow
          id="sitemap-enabled"
          label="Generate a sitemap"
          hint="Turn off to serve an empty sitemap and leave the Sitemap line out of robots.txt."
          checked={sitemap.enabled}
          onChange={(enabled) => setSitemap({ ...sitemap, enabled })}
        />
        <div className={cn("grid gap-3 border-t border-border pt-4 tablet:grid-cols-2", !sitemap.enabled && "pointer-events-none opacity-50")}>
          <ToggleRow id="sm-products" label="Products" checked={sitemap.products} onChange={(products) => setSitemap({ ...sitemap, products })} />
          <ToggleRow id="sm-categories" label="Categories" checked={sitemap.categories} onChange={(categories) => setSitemap({ ...sitemap, categories })} />
          <ToggleRow id="sm-brands" label="Brands" checked={sitemap.brands} onChange={(brands) => setSitemap({ ...sitemap, brands })} />
          <ToggleRow id="sm-pages" label="Content pages" checked={sitemap.pages} onChange={(pages) => setSitemap({ ...sitemap, pages })} />
          <ToggleRow id="sm-blog" label="Blog (posts, categories, tags)" checked={sitemap.blog} onChange={(blog) => setSitemap({ ...sitemap, blog })} />
        </div>
      </SeoCard>

      <SeoCard
        title="Structured data (schema.org)"
        description="Machine-readable markup that lets Google show prices, availability, your logo and breadcrumbs in search results."
      >
        <div className="grid gap-3 tablet:grid-cols-2">
          <ToggleRow id="sc-org" label="Organization" hint="Business name, logo and contact details." checked={schema.organization} onChange={(organization) => setSchema({ ...schema, organization })} />
          <ToggleRow id="sc-search" label="Site search box" hint="Lets Google show a search box for your store." checked={schema.website_search} onChange={(website_search) => setSchema({ ...schema, website_search })} />
          <ToggleRow id="sc-product" label="Products" hint="Price and availability on every product page." checked={schema.product} onChange={(product) => setSchema({ ...schema, product })} />
          <ToggleRow id="sc-breadcrumb" label="Breadcrumbs" hint="Shows the page path in results." checked={schema.breadcrumb} onChange={(breadcrumb) => setSchema({ ...schema, breadcrumb })} />
          <ToggleRow id="sc-blog" label="Blog" hint="Blog and article markup." checked={schema.blog} onChange={(blog) => setSchema({ ...schema, blog })} />
        </div>

        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-sm font-medium text-text-primary">Organization details</p>
          <div className="grid gap-4 tablet:grid-cols-2">
            <Field label="Business name" htmlFor="org-name" hint="Leave blank to use the store name.">
              <Input id="org-name" value={schema.org_name} onChange={(event) => setSchema({ ...schema, org_name: event.target.value })} />
            </Field>
            <Field label="Logo URL" htmlFor="org-logo" hint="A square or wide logo on a plain background.">
              <Input id="org-logo" value={schema.org_logo} placeholder="https://..." onChange={(event) => setSchema({ ...schema, org_logo: event.target.value })} />
            </Field>
            <Field label="Phone" htmlFor="org-phone">
              <Input id="org-phone" value={schema.org_phone} onChange={(event) => setSchema({ ...schema, org_phone: event.target.value })} />
            </Field>
            <Field label="Email" htmlFor="org-email">
              <Input id="org-email" type="email" value={schema.org_email} onChange={(event) => setSchema({ ...schema, org_email: event.target.value })} />
            </Field>
          </div>
          <Field label="Address" htmlFor="org-address">
            <Input id="org-address" value={schema.org_address} onChange={(event) => setSchema({ ...schema, org_address: event.target.value })} />
          </Field>
          <Field label="Social profiles" htmlFor="org-social" hint="One full URL per line (Facebook, Instagram, YouTube, X...). Helps Google connect your accounts to the brand.">
            <Textarea
              id="org-social"
              rows={3}
              value={schema.social_profiles}
              placeholder={"https://facebook.com/yourstore\nhttps://instagram.com/yourstore"}
              onChange={(event) => setSchema({ ...schema, social_profiles: event.target.value })}
            />
          </Field>
        </div>
      </SeoCard>

      <div className="flex justify-end">
        <Button type="button" loading={update.isPending} onClick={save}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

export default function SeoTechnicalPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data, isLoading } = useSeoSettings(storeId);

  if (currentUser && !can(currentUser, "seo.manage")) {
    return <PermissionDenied />;
  }

  if (isLoading || !data || !storeId) {
    return <Skeleton className="h-96 w-full" />;
  }

  return <TechnicalForm storeId={storeId} settings={data.settings} />;
}
