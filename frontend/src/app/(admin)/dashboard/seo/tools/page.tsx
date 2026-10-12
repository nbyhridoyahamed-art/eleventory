"use client";

import { useRef, useState } from "react";
import { Download, KeyRound, RefreshCw, Send, Upload } from "lucide-react";
import { toast } from "sonner";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useSeoSettings, useUpdateSeoSettings } from "@/hooks/use-seo-settings";
import { useGenerateIndexNowKey, useRescoreSeo, useSubmitIndexNow } from "@/hooks/use-seo-tools";
import { PermissionDenied } from "@/components/permission-denied";
import { SeoCard } from "@/components/seo/seo-ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeoSettings } from "@/types/seo-settings";

const IMPORT_GROUPS = ["site", "homepage", "blog", "robots", "sitemap", "schema", "verification", "analytics"] as const;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function SeoToolsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const { data, isLoading } = useSeoSettings(storeId);
  const rescore = useRescoreSeo(storeId ?? 0);
  const indexKey = useGenerateIndexNowKey(storeId ?? 0);
  const submit = useSubmitIndexNow(storeId ?? 0);
  const update = useUpdateSeoSettings(storeId ?? 0);

  if (currentUser && !can(currentUser, "seo.manage")) {
    return <PermissionDenied />;
  }

  const settings = data?.settings;
  const key = settings?.indexnow?.key ?? null;

  function exportSettings() {
    if (!settings) return;

    // The IndexNow key is site-specific, so it is left out of the export.
    const portable = Object.fromEntries(Object.entries(settings).filter(([group]) => group !== "indexnow"));
    const blob = new Blob([JSON.stringify(portable, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "seo-settings.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importSettings(file: File) {
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text()) as Partial<SeoSettings>;
      const payload: Record<string, Record<string, unknown>> = {};

      for (const group of IMPORT_GROUPS) {
        const value = parsed[group];
        if (value && typeof value === "object") {
          payload[group] = value as Record<string, unknown>;
        }
      }

      if (Object.keys(payload).length === 0) {
        toast.error("That file doesn't contain any SEO settings.");
        return;
      }

      update.mutate(payload);
    } catch {
      toast.error("That file isn't valid JSON.");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <SeoCard
        title="Instant indexing (IndexNow)"
        description="Tell Bing, Yandex and other IndexNow search engines about new or changed pages right away instead of waiting for them to be crawled."
      >
        <div className="space-y-4">
          <div className="rounded-md bg-shop-tint p-3 text-sm">
            <p className="font-medium text-text-primary">Your IndexNow key</p>
            <p className="mt-1 break-all font-mono text-xs text-text-secondary">{key ?? "Not generated yet"}</p>
            {key ? (
              <p className="mt-1 break-all text-xs text-text-muted">
                Verification file: {SITE_URL}/{key}.txt
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" loading={indexKey.isPending} onClick={() => indexKey.mutate()}>
              <KeyRound />
              {key ? "Regenerate key" : "Generate key"}
            </Button>
            <Button type="button" disabled={!key} loading={submit.isPending} onClick={() => submit.mutate(undefined)}>
              <Send />
              Submit all URLs
            </Button>
          </div>
          <p className="text-xs text-text-muted">
            IndexNow checks the key file on your public domain, so submissions only succeed once the storefront is live
            on that address (not on localhost).
          </p>
        </div>
      </SeoCard>

      <SeoCard
        title="Re-score content"
        description="Recalculates the stored SEO score for every product, page, category, brand and blog item. Run it after changing templates or editing content in bulk."
      >
        <Button type="button" loading={rescore.isPending} onClick={() => rescore.mutate()}>
          <RefreshCw />
          Re-score everything
        </Button>
      </SeoCard>

      <SeoCard
        title="Export & import settings"
        description="Move the site-wide SEO configuration (homepage meta, robots, sitemap, schema, verification and analytics IDs) between stores or keep a backup."
      >
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!settings} onClick={exportSettings}>
            <Download />
            Export settings
          </Button>
          <Button type="button" variant="outline" loading={importing || update.isPending} onClick={() => fileInput.current?.click()}>
            <Upload />
            Import settings
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import SEO settings file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importSettings(file);
            }}
          />
        </div>
        <p className="text-xs text-text-muted">Importing replaces the groups present in the file. Your IndexNow key is never exported.</p>
      </SeoCard>
    </div>
  );
}
