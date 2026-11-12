import type { PublicTheme } from "@/types/theme";

const SAFE_VAR_NAME = /^--[a-z0-9-]+$/;
// Hex colours and px/rem lengths only. The API validates already; this is the second lock.
const SAFE_VAR_VALUE = /^(#[0-9a-fA-F]{3,8}|\d{1,3}(\.\d+)?(px|rem))$/;

/** The stylesheet for a theme. Safe to inject with dangerouslySetInnerHTML: values are re-checked and "<" is stripped. */
export function buildThemeCss(theme: PublicTheme): string {
  const vars = Object.entries(theme.vars)
    .filter(([name, value]) => SAFE_VAR_NAME.test(name) && SAFE_VAR_VALUE.test(value))
    .map(([name, value]) => `${name}:${value};`)
    .join("");

  const parts: string[] = [];
  if (vars) parts.push(`:root{${vars}}`);
  if (theme.font_stack && /^[A-Za-z0-9 ,'"\-_.]+$/.test(theme.font_stack)) parts.push(`body{font-family:${theme.font_stack};}`);
  // The header sticks 36px up so the top strip scrolls away; without the strip it must stick at 0.
  if (!theme.topbar) parts.push(".storefront-topbar{display:none!important;}.storefront-header{top:0!important;}");
  if (theme.custom_css) parts.push(theme.custom_css);

  return parts.join("\n").replace(/</g, "");
}
