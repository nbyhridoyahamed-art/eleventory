"use client";

import { useState } from "react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useSeoSettings, useUpdateSeoSettings } from "@/hooks/use-seo-settings";
import { PermissionDenied } from "@/components/permission-denied";
import { Field, SeoCard } from "@/components/seo/seo-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeoSettings } from "@/types/seo-settings";

type VerificationKey = keyof SeoSettings["verification"];

const VERIFICATION: { key: VerificationKey; label: string; where: string; placeholder: string }[] = [
  {
    key: "google",
    label: "Google Search Console",
    where: "Search Console → Settings → Ownership verification → HTML tag. Paste only the content=\"…\" value.",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  },
  {
    key: "bing",
    label: "Bing Webmaster Tools",
    where: "Bing Webmaster Tools → Add site → HTML meta tag. Paste only the content value (msvalidate.01).",
    placeholder: "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  },
  { key: "yandex", label: "Yandex Webmaster", where: "Yandex Webmaster → Site verification → Meta tag value.", placeholder: "xxxxxxxxxxxxxxxx" },
  {
    key: "pinterest",
    label: "Pinterest",
    where: "Pinterest → Settings → Claimed accounts → Claim website → HTML tag (p:domain_verify).",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  },
  {
    key: "facebook",
    label: "Facebook / Meta domain verification",
    where: "Meta Business Suite → Brand safety → Domains → Meta-tag verification.",
    placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  },
  { key: "baidu", label: "Baidu Webmaster", where: "Baidu Search Resource Platform → Site verification → HTML tag.", placeholder: "codeva-xxxxxxxx" },
];

const ANALYTICS: { key: keyof SeoSettings["analytics"]; label: string; hint: string; placeholder: string }[] = [
  {
    key: "ga4_id",
    label: "Google Analytics 4 measurement ID",
    hint: "Analytics → Admin → Data streams → your web stream. Starts with G-.",
    placeholder: "G-XXXXXXXXXX",
  },
  {
    key: "gtm_id",
    label: "Google Tag Manager container ID",
    hint: "Starts with GTM-. If your GA4 tag already lives inside Tag Manager, leave the GA4 field blank to avoid counting visits twice.",
    placeholder: "GTM-XXXXXXX",
  },
  {
    key: "meta_pixel_id",
    label: "Meta (Facebook) Pixel ID",
    hint: "Events Manager → Data sources → your pixel. A number, 15–16 digits.",
    placeholder: "123456789012345",
  },
  {
    key: "clarity_id",
    label: "Microsoft Clarity project ID",
    hint: "Clarity → Settings → Overview. Free heatmaps and session recordings.",
    placeholder: "abcd1234ef",
  },
];

function IntegrationsForm({ storeId, settings }: { storeId: number; settings: SeoSettings }) {
  const update = useUpdateSeoSettings(storeId);
  const [verification, setVerification] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(settings.verification).map(([key, value]) => [key, value ?? ""])),
  );
  const [analytics, setAnalytics] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(settings.analytics).map(([key, value]) => [key, value ?? ""])),
  );

  return (
    <div className="space-y-6">
      <SeoCard
        title="Search engine verification"
        description="Prove you own the site so you can submit your sitemap and see search performance. The tags are added to every storefront page automatically."
      >
        <div className="grid gap-5 tablet:grid-cols-2">
          {VERIFICATION.map((item) => (
            <Field key={item.key} label={item.label} htmlFor={`verify-${item.key}`} hint={item.where}>
              <Input
                id={`verify-${item.key}`}
                value={verification[item.key] ?? ""}
                placeholder={item.placeholder}
                autoComplete="off"
                onChange={(event) => setVerification({ ...verification, [item.key]: event.target.value.trim() })}
              />
            </Field>
          ))}
        </div>
      </SeoCard>

      <SeoCard
        title="Analytics & tracking"
        description="Connect the tools you use to measure traffic and ads. Scripts load on the public storefront only — never in the admin or customer account areas."
      >
        <div className="grid gap-5 tablet:grid-cols-2">
          {ANALYTICS.map((item) => (
            <Field key={item.key} label={item.label} htmlFor={`analytics-${item.key}`} hint={item.hint}>
              <Input
                id={`analytics-${item.key}`}
                value={analytics[item.key] ?? ""}
                placeholder={item.placeholder}
                autoComplete="off"
                onChange={(event) => setAnalytics({ ...analytics, [item.key]: event.target.value.trim() })}
              />
            </Field>
          ))}
        </div>
        <p className="rounded-md bg-shop-tint p-3 text-xs text-text-secondary">
          These tools set cookies. If you sell to visitors in regions with cookie-consent rules, make sure your privacy
          policy covers them.
        </p>
      </SeoCard>

      <div className="flex justify-end">
        <Button type="button" loading={update.isPending} onClick={() => update.mutate({ verification, analytics })}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

export default function SeoIntegrationsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const { data, isLoading } = useSeoSettings(storeId);

  if (currentUser && !can(currentUser, "seo.manage")) {
    return <PermissionDenied />;
  }

  if (isLoading || !data || !storeId) {
    return <Skeleton className="h-96 w-full" />;
  }

  return <IntegrationsForm storeId={storeId} settings={data.settings} />;
}
