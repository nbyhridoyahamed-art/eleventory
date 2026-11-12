"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { buildThemeCss } from "@/lib/theme-css";
import { useThemePreviewStore } from "@/stores/theme-preview-store";
import type { PublicTheme } from "@/types/theme";

const STORAGE_KEY = "eleventory-theme-preview";
const STYLE_ID = "theme-preview-style";

/**
 * Shows an unpublished theme to whoever holds the preview link (?theme_preview=TOKEN). Visitors never see
 * it unless they have the token. The token is kept for the browser tab so the preview survives clicking
 * around; "Exit preview" forgets it. The published theme is rendered by the server as usual; this only
 * layers the draft on top in the browser.
 */
export function ThemePreview() {
  const [token, setToken] = useState<string | null>(null);
  const setPreview = useThemePreviewStore((s) => s.set);

  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("theme_preview");
      if (fromUrl) sessionStorage.setItem(STORAGE_KEY, fromUrl);
      setToken(fromUrl ?? sessionStorage.getItem(STORAGE_KEY));
    } catch {
      /* storage blocked: no preview */
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    api
      .get<PublicTheme>(`/storefront/theme?preview=${encodeURIComponent(token)}`)
      .then((theme) => {
        if (cancelled) return;
        let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
        if (!style) {
          style = document.createElement("style");
          style.id = STYLE_ID;
          document.head.appendChild(style);
        }
        style.textContent = buildThemeCss(theme);
        setPreview(true, theme.logo_url);
      })
      .catch(() => {
        // Wrong or rotated token: forget it and show the published theme.
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setToken(null);
      });

    return () => {
      cancelled = true;
    };
  }, [token, setPreview]);

  if (!token) return null;

  const exit = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("theme_preview");
    window.location.href = url.toString();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-3 bg-slate-900 px-4 py-2 text-sm text-white">
      <span>Previewing your unpublished theme. Only people with this link can see it.</span>
      <button type="button" onClick={exit} className="rounded border border-white/40 px-2 py-0.5 text-xs font-semibold hover:bg-white/10">
        Exit preview
      </button>
    </div>
  );
}
