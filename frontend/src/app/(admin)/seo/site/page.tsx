"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useSeoSettings, useUpdateSeoSettings } from "@/hooks/use-seo-settings";
import { PermissionDenied } from "@/components/permission-denied";
import { CountedInput, CountedTextarea, Field, SeoCard, SerpPreview } from "@/components/seo/seo-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { seoRules } from "@/lib/seo-score";
import type { PageMeta, SeoSettings, SeoSuggestions } from "@/types/seo-settings";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type MetaDraft = { title: string; description: string; focus_keyword: string; og_image: string };

const toDraft = (meta: PageMeta): MetaDraft => ({
  title: meta.title ?? "",
  description: meta.description ?? "",
  focus_keyword: meta.focus_keyword ?? "",
  og_image: meta.og_image ?? "",
});

function SiteForm({ storeId, settings, suggestions }: { storeId: number; settings: SeoSettings; suggestions: SeoSuggestions | null }) {
  const update = useUpdateSeoSettings(storeId);
  const [home, setHome] = useState<MetaDraft>(toDraft(settings.homepage));
  const [blog, setBlog] = useState<MetaDraft>(toDraft(settings.blog));
  const [site, setSite] = useState({
    site_name: settings.site.site_name ?? "",
    default_og_image: settings.site.default_og_image ?? "",
    twitter_handle: settings.site.twitter_handle ?? "",
  });

  const homeScore = ruleSummary(home);
  const blogScore = ruleSummary(blog);

  function save() {
    update.mutate({ homepage: home, blog, site });
  }

  const metaFields = (
    prefix: string,
    value: MetaDraft,
    set: (value: MetaDraft) => void,
    titlePlaceholder: string,
  ) => (
    <>
      <Field label="SEO title" htmlFor={`${prefix}-title`}>
        <CountedInput id={`${prefix}-title`} value={value.title} onChange={(title) => set({ ...value, title })} range={[30, 60]} placeholder={titlePlaceholder} />
      </Field>
      <Field label="Meta description" htmlFor={`${prefix}-description`}>
        <CountedTextarea id={`${prefix}-description`} value={value.description} onChange={(description) => set({ ...value, description })} range={[120, 160]} />
      </Field>
      <div className="grid gap-4 tablet:grid-cols-2">
        <Field label="Focus keyword" htmlFor={`${prefix}-keyword`} hint="The phrase you most want this page to rank for.">
          <Input id={`${prefix}-keyword`} value={value.focus_keyword} onChange={(event) => set({ ...value, focus_keyword: event.target.value })} />
        </Field>
        <Field label="Social sharing image URL" htmlFor={`${prefix}-og`} hint="Shown when the page is shared on Facebook, WhatsApp or X. 1200×630 works best.">
          <Input id={`${prefix}-og`} value={value.og_image} placeholder="https://..." onChange={(event) => set({ ...value, og_image: event.target.value })} />
        </Field>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <SeoCard
        title="Homepage"
        description="The title and description search engines show for your homepage, and the image used when it is shared."
        action={
          suggestions ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setHome({ ...home, ...suggestions.homepage })}>
              <Sparkles />
              Use suggestion
            </Button>
          ) : null
        }
      >
        {metaFields("home", home, setHome, "Your store name - what you sell, where")}
        <SerpPreview title={home.title} description={home.description} url={SITE_URL} />
        <p className="text-xs text-text-muted">
          SEO checklist: {homeScore.passed}/{homeScore.total} checks pass. Homepage content, banners and the product
          rows are edited in{" "}
          <Link href="/content/homepage" className="font-medium text-primary hover:underline">
            Homepage
          </Link>
          .
        </p>
      </SeoCard>

      <SeoCard
        title="Blog page"
        description="The blog landing page at /blog, optimised separately from the individual posts."
        action={
          suggestions ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setBlog({ ...blog, ...suggestions.blog })}>
              <Sparkles />
              Use suggestion
            </Button>
          ) : null
        }
      >
        {metaFields("blog", blog, setBlog, "Store name Blog - guides, tips & news")}
        <SerpPreview title={blog.title} description={blog.description} url={`${SITE_URL}/blog`} />
        <p className="text-xs text-text-muted">
          SEO checklist: {blogScore.passed}/{blogScore.total} checks pass. Individual posts are managed in{" "}
          <Link href="/content/blog/posts" className="font-medium text-primary hover:underline">
            Blog
          </Link>
          .
        </p>
      </SeoCard>

      <SeoCard title="Site defaults" description="Used wherever a page has nothing more specific.">
        <div className="grid gap-4 tablet:grid-cols-2">
          <Field label="Site name" htmlFor="site-name" hint="Shown as the site name in social previews. Leave blank to use the store name.">
            <Input id="site-name" value={site.site_name} onChange={(event) => setSite({ ...site, site_name: event.target.value })} />
          </Field>
          <Field label="X (Twitter) handle" htmlFor="site-twitter" hint="Optional, e.g. @yourstore.">
            <Input id="site-twitter" value={site.twitter_handle} placeholder="@yourstore" onChange={(event) => setSite({ ...site, twitter_handle: event.target.value })} />
          </Field>
        </div>
        <Field label="Default social sharing image URL" htmlFor="site-og" hint="Used when a page or the homepage has no image of its own.">
          <Input id="site-og" value={site.default_og_image} placeholder="https://..." onChange={(event) => setSite({ ...site, default_og_image: event.target.value })} />
        </Field>
      </SeoCard>

      <div className="flex justify-end">
        <Button type="button" loading={update.isPending} onClick={save}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

export default function SeoSitePage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;

  const { data, isLoading } = useSeoSettings(storeId);

  if (currentUser && !can(currentUser, "seo.manage")) {
    return <PermissionDenied />;
  }

  if (isLoading || !data || !storeId) {
    return <Skeleton className="h-96 w-full" />;
  }

  return <SiteForm storeId={storeId} settings={data.settings} suggestions={data.suggestions} />;
}

function ruleSummary(seo: Parameters<typeof seoRules>[0]) {
  const rules = seoRules(seo);
  return { passed: rules.filter((rule) => rule.passed).length, total: rules.length };
}
