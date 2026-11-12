"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, ImagePlus, X } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDiscardThemeDraft, usePublishTheme, useSaveThemeDraft, useTheme } from "@/hooks/use-theme";
import { MediaPickerDialog } from "@/components/settings/media-picker-dialog";
import { PermissionDenied } from "@/components/permission-denied";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { ThemeConfig, ThemePreset, ThemeRadius } from "@/types/theme";

const HEX = /^#[0-9a-fA-F]{6}$/;
const RADII: { key: ThemeRadius; label: string }[] = [
  { key: "sharp", label: "Sharp" },
  { key: "soft", label: "Soft" },
  { key: "round", label: "Round" },
];

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={HEX.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="size-9 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        />
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={7}
          spellCheck={false}
          className="h-9 w-32 rounded-md border border-border bg-surface px-3 font-mono text-sm"
        />
        {!HEX.test(value) ? <span className="text-xs text-danger">Use a colour like #0b3f91</span> : null}
      </div>
    </div>
  );
}

function PresetCard({ preset, active, onUse }: { preset: ThemePreset; active: boolean; onUse: () => void }) {
  return (
    <Card className={active ? "border-2 border-primary" : undefined}>
      <div className="flex h-28 flex-col gap-2 bg-background p-3.5" aria-hidden="true">
        <div className="h-3 w-full rounded" style={{ background: preset.colors.nav }} />
        <div className="flex-1 rounded-lg bg-surface" />
        <div className="h-5 w-1/3 rounded" style={{ background: preset.colors.accent }} />
      </div>
      <CardContent className="flex items-center justify-between pt-4">
        <div>
          <div className="font-semibold">{preset.name}</div>
          <div className="text-xs text-text-secondary">{preset.blurb}</div>
        </div>
        {active ? (
          <Badge variant="success">Selected</Badge>
        ) : (
          <Button size="sm" variant="outline" onClick={onUse}>
            Use
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function MediaChoice({
  label,
  hint,
  url,
  onPick,
  onClear,
  storeId,
}: {
  label: string;
  hint: string;
  url: string | null;
  onPick: (id: number, url: string) => void;
  onClear: () => void;
  storeId: number | null | undefined;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="flex size-14 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImagePlus className="size-5 text-text-muted" aria-hidden="true" />
          )}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          {url ? "Change" : "Choose or upload"}
        </Button>
        {url ? (
          <Button type="button" size="sm" variant="ghost" onClick={onClear} aria-label={`Remove ${label.toLowerCase()}`}>
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-text-secondary">{hint}</p>
      <MediaPickerDialog open={open} onOpenChange={setOpen} storeId={storeId} onSelect={(media) => onPick(media.id, media.url)} />
    </div>
  );
}

export default function ThemesSettingsPage() {
  const { data: currentUser } = useCurrentUser();
  const { data, isLoading } = useTheme();
  const save = useSaveThemeDraft();
  const publish = usePublishTheme();
  const discard = useDiscardThemeDraft();

  const [config, setConfig] = useState<ThemeConfig | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);

  // Load the saved draft into the editor, and again whenever it is replaced (save, publish, discard).
  useEffect(() => {
    if (data) {
      setConfig(data.draft);
      setLogoUrl(data.logo_url);
      setFaviconUrl(data.favicon_url);
    }
  }, [data]);

  if (currentUser && !can(currentUser, "settings.manage")) return <PermissionDenied />;

  if (isLoading || !data || !config) {
    return <Skeleton className="h-96 w-full" />;
  }

  const patch = (changes: Partial<ThemeConfig>) => setConfig({ ...config, ...changes });
  const dirty = JSON.stringify(config) !== JSON.stringify(data.draft);
  const colorsValid = HEX.test(config.colors.nav) && HEX.test(config.colors.accent);
  const busy = save.isPending || publish.isPending || discard.isPending;

  const usePreset = (preset: ThemePreset) => patch({ preset: preset.key, colors: preset.colors, radius: preset.radius, font: preset.font });

  const previewUrl = `${data.storefront_url}/?theme_preview=${encodeURIComponent(data.preview_token)}`;

  // Publishing sends exactly what is in the editor, so nothing on screen is left out.
  const publishNow = () => save.mutate(config, { onSuccess: () => publish.mutate() });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Your storefront theme</span>
              {dirty || data.has_unpublished_changes ? <Badge variant="warning">Unpublished changes</Badge> : <Badge variant="success">Published</Badge>}
            </div>
            <p className="text-xs text-text-secondary">
              Changes are saved as a draft first. Visitors only see them after you publish.
              {data.published_at ? ` Last published ${new Date(data.published_at).toLocaleString()}.` : " Nothing published yet: your store uses the standard look."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => save.mutate(config)} disabled={busy || !dirty || !colorsValid}>
              Save draft
            </Button>
            <Button variant="outline" asChild>
              <a href={previewUrl} target="_blank" rel="noreferrer" className={dirty ? "pointer-events-none opacity-50" : undefined} aria-disabled={dirty}>
                Preview <ExternalLink className="ml-1.5 size-3.5" aria-hidden="true" />
              </a>
            </Button>
            <Button onClick={publishNow} disabled={busy || !colorsValid || (!dirty && !data.has_unpublished_changes)}>
              Publish
            </Button>
          </div>
        </CardContent>
      </Card>
      {dirty ? <Alert variant="info">Save the draft to preview it. The preview link shows your saved draft.</Alert> : null}

      <div className="grid gap-4 md:grid-cols-3">
        {data.presets.map((preset) => (
          <PresetCard key={preset.key} preset={preset} active={config.preset === preset.key} onUse={() => usePreset(preset)} />
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <ColorField id="nav-colour" label="Header and footer colour" value={config.colors.nav} onChange={(nav) => patch({ colors: { ...config.colors, nav } })} />
            <ColorField id="accent-colour" label="Accent colour (buttons, badges)" value={config.colors.accent} onChange={(accent) => patch({ colors: { ...config.colors, accent } })} />
            <p className="text-xs text-text-secondary">Text on these colours switches between dark and light automatically so it stays readable.</p>

            <div className="space-y-1.5">
              <Label>Corners</Label>
              <div className="flex gap-2">
                {RADII.map((radius) => (
                  <Button key={radius.key} type="button" size="sm" variant={config.radius === radius.key ? "primary" : "outline"} onClick={() => patch({ radius: radius.key })}>
                    {radius.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="theme-font">Font</Label>
              <select
                id="theme-font"
                value={config.font}
                onChange={(event) => patch({ font: event.target.value as ThemeConfig["font"] })}
                className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
              >
                {data.fonts.map((font) => (
                  <option key={font.key} value={font.key}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={config.topbar} onChange={(event) => patch({ topbar: event.target.checked })} />
              Show the top strip (delivery note and About / Blog / Contact links)
            </label>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Logo and icon</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <MediaChoice
                label="Logo"
                hint="Shown in the header instead of your shop's initial. A wide PNG or SVG on a transparent background works best."
                url={logoUrl}
                storeId={currentUser?.current_store_id}
                onPick={(id, url) => {
                  patch({ logo_media_id: id });
                  setLogoUrl(url);
                }}
                onClear={() => {
                  patch({ logo_media_id: null });
                  setLogoUrl(null);
                }}
              />
              <MediaChoice
                label="Favicon"
                hint="The small icon in the browser tab. Square, at least 64 x 64 pixels."
                url={faviconUrl}
                storeId={currentUser?.current_store_id}
                onPick={(id, url) => {
                  patch({ favicon_media_id: id });
                  setFaviconUrl(url);
                }}
                onClear={() => {
                  patch({ favicon_media_id: null });
                  setFaviconUrl(null);
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom CSS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.can_custom_css ? (
                <>
                  <textarea
                    aria-label="Custom CSS"
                    value={config.custom_css ?? ""}
                    onChange={(event) => patch({ custom_css: event.target.value || null })}
                    rows={8}
                    spellCheck={false}
                    placeholder={".storefront-header { letter-spacing: 0.02em; }"}
                    className="w-full rounded-md border border-border bg-surface p-3 font-mono text-xs"
                  />
                  <p className="text-xs text-text-secondary">
                    Styles only, up to 20 KB. Not allowed: <code>@import</code>, <code>url()</code> (so nothing loads from other sites), scripts and markup. Anything rejected is explained when you save.
                  </p>
                </>
              ) : (
                <Alert variant="info">
                  Custom CSS is part of the Growth plan and above. <Link href="/dashboard/settings/billing" className="font-semibold underline">See plans</Link>
                </Alert>
              )}
            </CardContent>
          </Card>

          {dirty || data.has_unpublished_changes ? (
            <Button variant="ghost" size="sm" onClick={() => discard.mutate()} disabled={busy}>
              Discard draft and go back to the published theme
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
