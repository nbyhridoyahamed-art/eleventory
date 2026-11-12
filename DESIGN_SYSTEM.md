# DESIGN SYSTEM

Source of truth: `frontend/src/styles/tokens.css` (values) and
`frontend/src/styles/theme.css` (semantic mapping + dark mode). Nothing
in components hard-codes a hex color, font, radius, or breakpoint —
everything reads a CSS variable or Tailwind token that maps to one.

## 1. Color Tokens (spec section 45)

| Token | Light | Usage |
|---|---|---|
| `--color-primary` | `#2563EB` | primary actions, links, focus ring |
| `--color-success` | `#107435` | success states, delivered/paid badges |
| `--color-warning` | `#8D5A06` | low stock, pending, warnings |
| `--color-danger` | `#C21F1F` | destructive actions, errors, out of stock |
| `--color-info` | `#096B97` | informational badges |
| `--color-background` | `#F8FAFC` | app background |
| `--color-surface` | `#FFFFFF` | cards, panels, tables |
| `--color-border` | `#E2E8F0` | dividers, input borders |
| `--color-text-primary` | `#0F172A` | headings, body text |
| `--color-text-secondary` | `#64748B` | secondary text |
| `--color-text-muted` | `#5F6D88` | placeholders, captions |

Phase 23 darkened success/warning/danger/info from their original,
more-saturated values (`#16A34A`/`#F59E0B`/`#DC2626`/`#0EA5E9`) and
darkened text-muted a second time (`#94A3B8` → `#677690` → `#5F6D88`) —
see section 8 for why. `--color-primary` itself is unchanged; only its
`/10`-opacity badge/avatar/tab-highlight tint moved to `/8` at each call
site (`Badge`, `Avatar`, `StatCard`, sidebar/builder tab highlights),
leaving the brand blue itself untouched.

## 2. Dark Mode (spec section 46)

A true dark theme, not an inverted one:

| Token | Dark |
|---|---|
| `--color-success` | `#16A34A` (original, not the Phase 23 light-mode darkening) |
| `--color-warning` | `#F59E0B` (original) |
| `--color-danger` | `#DC2626` (original) |
| `--color-info` | `#0EA5E9` (original) |
| `--color-background` | `#0B1120` |
| `--color-surface` | `#111827` |
| `--color-surface-elevated` | `#172033` |
| `--color-border` | `#243044` |
| `--color-text-primary` | `#F8FAFC` |
| `--color-text-secondary` | `#94A3B8` |
| `--color-text-muted` | `#7C8AA5` |

Applied via `@media (prefers-color-scheme: dark)` guarded by
`:root:not([data-theme="light"])`, and `:root[data-theme="dark"]` for an
explicit user toggle (persisted client-side), matching the pattern the
platform's own artifact/theming convention uses.

`--color-primary` has no dark-mode override — it inherits the same
`#2563EB` light mode uses. Phase 23 found this (and the un-overridden
`--color-danger`, before the explicit restore above) fails WCAG 4.5:1
*as text* against every dark surface (as low as 2.72:1), but a lighter
shade that fixes that breaks the *opposite* case — white text on a
solid `bg-primary`/`bg-danger` button, which passes comfortably as-is
(`#2563EB`/`#DC2626` are only used as a background there, so the
surrounding theme doesn't matter). One token can't serve both roles;
splitting "accent text" from "solid fill" into separate tokens is
deferred rather than partially patched (see section 8).

## 3. Typography

- **English:** Inter.
- **Bangla:** Noto Sans Bengali (loaded alongside Inter; Bangla text
  gets a slightly taller `line-height` — 1.6 vs. 1.5 for Latin — because
  Bengali glyphs need more vertical room to avoid clipping).
- Scale: Display 32–40px / Page title 24–28px / Section 18–20px / Body
  14–16px / Table 13–14px / Caption 12px — implemented as Tailwind
  `text-*` utility aliases (`text-display`, `text-page-title`, etc.) in
  `tailwind.config.ts`, not ad-hoc `text-[32px]` in components.

## 4. Spacing, Radius, Shadow

- Spacing scale: Tailwind default 4px base unit, used consistently
  (no arbitrary `px-[13px]` values).
- Radius tokens: `--radius-sm` (6px), `--radius-md` (8px), `--radius-lg`
  (12px) — buttons/inputs use `sm`, cards use `md`, modals use `lg`.
- Shadow tokens: `--shadow-sm`, `--shadow-md`, `--shadow-lg` for
  elevation (cards, dropdowns, modals respectively).

## 5. Breakpoints (spec section 119)

| Name | Range |
|---|---|
| mobile | `<640px` |
| tablet | `640–1024px` |
| desktop | `1024–1440px` |
| large | `1440px+` |

Large-desktop content is capped at `max-width: 1600px` and centered
(spec section 121) — it never stretches full-bleed on ultra-wide
monitors.

## 6. Component States

Every interactive component (see `COMPONENT_INVENTORY.md`) is built to
support: **default, hover, focus, active, disabled, loading, error,
success** — enforced by building each primitive once in
`frontend/src/components/ui/` on top of Radix (which gives correct
focus/keyboard/ARIA behavior for free) and Tailwind variants, rather
than re-implementing state handling per screen.

## 7. Motion

Subtle only: fade/slide/scale on enter-exit, hover micro-transitions.
Everything respects `prefers-reduced-motion` (global CSS guard disables
non-essential transitions). ERP screens are intentionally calm — no
decorative animation on data tables or forms (spec section 122).

## 8. Accessibility Baseline

Target WCAG 2.2 AA (spec section 123). Phase 23 measured this for real
with axe-core (Playwright) across 16 representative pages — filter
toolbars, the largest forms, list/data-table views, and the storefront —
rather than assuming Radix primitives and 4.5:1-by-eye color choices
were sufficient. It found and fixed 9 distinct violation categories, all
now at 0 violations across every audited page (both themes for color
contrast):

- **`button-name` (critical, 79 nodes across 44 files):** every Radix
  `Select`/`SelectTrigger` (a `role="combobox"` button) needs an
  explicit accessible name — the visibly-rendered *selected value* does
  not count toward that computation the way a plain button's text does.
  Fixed via native `<label htmlFor>`/`id` wiring where a label already
  sits next to the field, or a purpose-describing `aria-label` for
  standalone filters and unlabeled per-row selects (e.g. `` `Product for
  item ${index + 1}` `` in a repeating order-line list).
- **`color-contrast` (serious):** the `--color-success/warning/danger/info`
  tokens (section 1) failed 4.5:1 both as plain text and inside their
  own badge tint — as low as 1.99:1, not a near-miss. Darkened in place
  (same hue/saturation, lower lightness only); dark mode explicitly
  keeps the original, already-passing values (section 2). `--color-text-muted`
  needed a second darkening pass — the first (Phase 2-era) fix passed
  against white but not against the app's actual `#F8FAFC` background.
  `AlertDescription` moved from `text-text-secondary` to `text-text-primary`
  (its own tinted background pulled effective contrast below 4.5:1).
  `bg-primary/10` text/icon tints (`Avatar`, `Badge`, `StatCard`, tab
  highlights) moved to `/8` rather than touching the primary token
  itself.
- **`heading-order`:** `CardTitle` rendered an `<h3>` under a page `<h1>`
  with no `<h2>` between them; now `<h2>`. The homepage builder's Hero
  block heading was a styled `<p>`, not a heading at all; now `<h1>`
  (each page should have exactly one).
- **`empty-table-header`:** `DataTable` columns with no visible header
  text (an actions column, say) rendered a blank `<th>`; now falls back
  to a humanized, `sr-only` label built from the column id.
- **`landmark-*` / missing labels:** the login page's outer wrapper
  became a `<main>` landmark. 12 admin section tab-bars (11 route
  layouts plus the product form's internal section tabs) share the
  literal `<nav>` markup, which is indistinguishable to a screen reader
  across multiple instances on one page — each now has a specific
  `aria-label` (e.g. `"Catalog sections"`, `"Product form sections"`).
  7 analytics/report date-range filters had two adjacent, identically
  unlabeled `<input type="date">`s — each pair now has `"From date"`/`"To date"`.

**Known, deliberately deferred gap:** `--color-primary` and
`--color-danger` are used both as accent *text* (needs a shade that
reads against a background) and as a solid *button fill* with white
text (needs a shade dark/light enough to hold that text) — in light
mode the same hex happens to satisfy both; in dark mode it can't (proven,
not assumed — see section 2). Fixing the text-on-dark-surface side
without breaking the button side needs a second "accent" token per
color, which is a small architecture change, not a token tweak, so it's
left for a dedicated pass rather than partially patched here. This
pre-dates Phase 23 and was not made worse by it.

All primitives come from Radix for correct keyboard/focus/ARIA
semantics; focus rings use `--color-primary` at full opacity, never
`outline: none` without a visible replacement.

## 9. What This Session Implements

Tokens, theme.css (light+dark), typography setup (Inter + Noto Sans
Bengali), and the first tranche of primitives (Button, Input, Label,
Card, Badge, Avatar, Separator, Sidebar/Topbar shell) — enough to build
the login page and dashboard shell. The remaining primitives in
`COMPONENT_INVENTORY.md` are added as the phases that need them land,
so nothing ships half-wired.

---

## Eleventory brand layer (current)

The merchant dashboard, sign-in pages, legal pages and the marketing page use the Eleventory brand. Source of truth: `brand/guide.html` (guideline), `brand/dashboard.html` (dashboard design), `brand/site.html` (marketing design). The older blue tokens above still drive the storefront and anything outside the brand surface.

- **Scope.** `src/styles/brand.css` overrides the tokens under `.surface-brand` only. `BrandSurface` (`components/shared/brand-surface.tsx`) applies it in the `(admin)`, `(auth)`, `(legal)` and `store-unavailable` layouts and on `<body>` so dialogs, menus and toasts match. Storefront pages never mount it.
- **Colour.** Teal Ink `#0A2E2C`, Teal `#0B5D59`, Coral `#FF6A4D`, Sunflower `#F7B538`, Mist `#F1F4F3`. Dark mode values are in `brand.css`. Coral is a fill, not a text colour; text on coral is ink (5.2:1). Use `text-on-primary` / `text-on-accent`, never `text-white`, on filled surfaces.
- **Type.** Bricolage Grotesque (`font-display`), Figtree (text), JetBrains Mono (data), Anek Bangla (Bangla). Loaded by `src/lib/brand-fonts.ts` in brand layouts only.
- **Logo.** `components/shared/logo.tsx` serves the files in `public/brand/` (generated by `brand/build.js` and `brand/export.js`). Use `tone="reverse"` on dark surfaces such as the sidebar rail.
- **Charts.** Single series use teal. Multi-series use fixed colours by entity. `Sparkline` and `Donut` live in `components/charts/`.
- **Marketing page.** `src/components/marketing/landing.css`, `landing-html.ts` and `landing-behaviour.ts` are generated from `brand/site.src.html` by `node brand/make-landing.js`. Edit the source and regenerate.
- **Icons.** `src/app/icon.svg`, `favicon.ico`, `apple-icon.png` and `manifest.ts`.
