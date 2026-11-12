/** What the storefront needs to dress itself. The API has already validated every value. */
export interface PublicTheme {
  /** CSS custom properties, e.g. { "--color-shop-nav": "#0b3f91" }. */
  vars: Record<string, string>;
  /** A font-family stack, chosen from a short fixed list (never a merchant-supplied font). */
  font_stack: string | null;
  /** Show the thin top bar (About / Blog / Contact links) above the header. */
  topbar: boolean;
  /** Sanitised by the API: no url(), no @import, no markup. Null on plans without custom CSS. */
  custom_css: string | null;
  logo_url: string | null;
  favicon_url: string | null;
}

export type ThemeRadius = "sharp" | "soft" | "round";
export type ThemeFont = "inter" | "system" | "serif" | "rounded";

/** The merchant's choices (a draft or the published copy). */
export interface ThemeConfig {
  preset: string;
  colors: { nav: string; accent: string };
  radius: ThemeRadius;
  font: ThemeFont;
  topbar: boolean;
  logo_media_id: number | null;
  favicon_media_id: number | null;
  custom_css: string | null;
}

export interface ThemePreset {
  key: string;
  name: string;
  blurb: string;
  colors: { nav: string; accent: string };
  radius: ThemeRadius;
  font: ThemeFont;
}

export interface AdminTheme {
  draft: ThemeConfig;
  published: ThemeConfig | null;
  has_unpublished_changes: boolean;
  published_at: string | null;
  presets: ThemePreset[];
  fonts: { key: ThemeFont; label: string }[];
  /** Custom CSS is a plan feature; false on plans without it. */
  can_custom_css: boolean;
  logo_url: string | null;
  favicon_url: string | null;
  /** Add ?theme_preview=<token> to any storefront address to see the draft. */
  preview_token: string;
  /** The shop's public address, e.g. https://shop.example.com */
  storefront_url: string;
}
