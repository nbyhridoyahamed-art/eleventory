# Eleventory → multi-tenant SaaS (Shopify-style): review, plan and master prompt

Reviewed 2026-10-29 against branch `claude/friendly-knuth-kqj7zw`.

---

## 1. What the project is today

| Area | State |
|---|---|
| Stack | Laravel 13 / PHP 8.4 API (Sanctum, spatie/permission), Next.js 16 storefront + admin, MariaDB, ~240 routes, ~580 tests |
| Data model | **Multi-store-ready schema.** `organizations → stores`, `store_id` on ~49 tables, composite uniques (`store_id+slug`, `store_id+sku`, `store_id+order_number`), per-store settings / SEO / notification settings / couriers |
| Features | Catalog, variants, bundles, inventory + warehouses, purchasing, orders, COD, couriers (Steadfast), coupons, customers, reviews, blog/pages, homepage blocks, SEO suite, SMS (BulkSMSBD) + SMTP, analytics, MCP/AI assistant |
| Auth | Staff users (Sanctum tokens), customers (separate token type), staff self-sign-up with email verification (just added; new users get no role) |
| Hosting | cPanel shared hosting, FTP + File Manager only, no SSH, no wildcard SSL |

The business logic is rich. The platform layer (tenancy, onboarding, billing, domains, platform admin) does not exist yet.

## 2. Gaps that block a SaaS launch (verified in code)

### Critical – security
1. **No tenant isolation.** Controllers trust a `store_id` request parameter. Nothing checks that the signed-in user belongs to that store (`store_user` is only a relation; no policy, middleware or global scope uses it). Any staff user can pass another store's id and read or write its products, customers, orders and settings. Today this is harmless with one store; with tenants it is a data-breach bug.
2. **Roles/permissions are global**, not per store (spatie `teams` disabled). A "Store Admin" in one shop would be one everywhere.
3. **No global query scope / `BelongsToStore` trait.** Isolation depends on every query remembering a `where('store_id', …)`.
4. **Secrets**: courier `api_key/api_secret`, SMTP, SMS keys live in DB columns; confirm they are encrypted at rest (`encrypted` cast) before holding other people's credentials.
5. The storefront API and Sanctum tokens have **no tenant claim**; a customer token is not bound to a store.

### Critical – product
6. **Storefront serves "whichever store is active"** (`StorefrontController::currentStore()` = first active store). No host/domain resolution even though `stores.domain` exists.
7. **No sign-up → store creation flow.** Registration creates a role-less user only; no organization, store, owner role, default data (warehouse, currency, pages, homepage blocks) or onboarding wizard.
8. **No plans, subscriptions, trials, limits, invoices or dunning.**
9. **No platform (super-admin) layer**: tenant list, suspend/unsuspend, impersonation, plan management, platform analytics, abuse handling.
10. **No custom domains / subdomains / SSL automation.** Shared cPanel cannot do wildcard or on-demand TLS.

### Important
11. Frontend hard-codes single-site assumptions (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, one robots/sitemap/SEO host, one `STOREFRONT_SSR_KEY`).
12. Media on the local `public` disk with no per-tenant prefix, quota or CDN.
13. Queue = `database`, one scheduler entry, no workers on shared hosting; notifications/SMS/couriers need reliable queues at scale.
14. Rate limits are per-IP; a SaaS needs per-tenant limits and noisy-neighbour protection.
15. Payments: COD and manual methods only; no online gateway for merchants' customers (bKash / SSLCommerz / Nagad / Stripe) and none for charging merchants.
16. Missing legal/ops basics: ToS/Privacy, data export/delete per tenant, backups with per-tenant restore, status/monitoring, email deliverability (SPF/DKIM per sending domain).
17. Theming: only homepage blocks; no theme presets / per-tenant branding beyond name.

## 3. Target architecture

- **Tenant = Store; account = Organization.** Keep the existing `store_id` column as the tenant key (no rewrite). One organization can own several stores.
- **Shared database, shared schema, row-level isolation** enforced three ways: (a) `TenantContext` resolved once per request, (b) `BelongsToStore` trait + global scope on every tenant model, (c) automatic `store_id` on create. Plus a membership middleware on all admin routes.
- **Per-store roles** via spatie teams (`team_foreign_key = store_id`); platform roles (`platform_admin`) live outside any team.
- **Three surfaces**
  - `app.<platform>.com` – merchant admin (one admin domain for everyone; store chosen from the user's memberships).
  - `<slug>.<platform>.com` and verified custom domains – storefronts, resolved by `Host`.
  - `admin.<platform>.com` (or `/platform`) – super-admin.
- **Domains**: subdomain on sign-up; custom domain via CNAME + TXT verification; TLS via Caddy on-demand TLS (or Cloudflare for SaaS) – requires a VPS, not shared cPanel.
- **Billing**: plans (limits: products, staff seats, orders/month, storage, custom domain, features), subscription state machine (trial → active → past_due → suspended → cancelled), webhooks, invoices. Local BD gateways (SSLCommerz/bKash) and optionally Stripe for international.
- **Infra**: VPS or small cluster (Docker), Nginx/Caddy, PHP-FPM, Node, MariaDB (managed or replicated), Redis (cache + queues), Supervisor/Horizon workers, scheduler, S3/R2 media with `tenants/{store_uuid}/` prefix + CDN, daily encrypted backups, Sentry + uptime monitoring.
- **Existing elevendollar.store becomes tenant #1** after migration, proving the model on real data.

## 4. Phased plan

Each phase ships on its own, behind tests, without breaking the live store.

| # | Phase | Outcome | Rough effort |
|---|---|---|---|
| 0 | **Decisions + safety net** | Locked decisions (below), baseline tests, staging environment, feature flag `SAAS_MODE` | 2–3 days |
| 1 | **Tenant isolation core** | `TenantContext`, `BelongsToStore` + global scope on all 49 tables, membership middleware, spatie teams, per-store roles, **cross-tenant leak test suite** (every route × two tenants) | 1.5–2 weeks |
| 2 | **Sign-up & onboarding** | Public sign-up → verify email → create organization + store + owner → seed defaults (warehouse, currency, pages, homepage blocks, sample category) → onboarding checklist wizard | 1–1.5 weeks |
| 3 | **Multi-tenant storefront** | Host-based store resolution, subdomains, per-tenant SEO/robots/sitemap/cache keys, tenant-aware SSR key, 404 / "store unavailable" pages | 1–1.5 weeks |
| 4 | **Domains & TLS** | Custom-domain add/verify UI, Caddy on-demand TLS endpoint, redirects, domain status | 1 week (needs VPS) |
| 5 | **Plans, billing, limits** | Plan model + limit enforcement middleware, trial, subscription lifecycle, invoices, gateway webhooks, dunning emails, upgrade/downgrade UI | 2–3 weeks |
| 6 | **Platform super-admin** | Tenant directory, suspend/restore, impersonate (audited), plan editor, platform MRR/usage dashboard, abuse/ban tools, support notes | 1.5–2 weeks |
| 7 | **Merchant payments** | Per-store payment gateways (SSLCommerz/bKash/Nagad/Stripe), encrypted credentials, order payment webhooks, refunds | 2 weeks |
| 8 | **Infra & scale** | VPS/Docker, Redis queues + workers, S3/R2 media with prefixes + quotas, per-tenant rate limits, backups/restore, monitoring, mail domain auth | 1.5–2 weeks |
| 9 | **Themes & customisation** | Theme presets, brand colours/fonts/logo, homepage block templates per theme, per-tenant custom CSS (sandboxed) | 2 weeks |
| 10 | **Compliance & launch** | ToS/Privacy/DPA, tenant data export + deletion, audit log, onboarding emails, docs/help centre, migrate elevendollar.store as tenant #1, closed beta → public | 1.5 weeks |

Order matters: **1 before anything public**, 3 before 4, 5 before opening sign-up to strangers. Phases 7 and 9 can run in parallel after 3.

## 5. Decisions to confirm before Phase 0 (defaults assumed)

1. Tenancy model: shared DB + `store_id` row isolation (default) vs database-per-tenant.
2. Platform domain (e.g. `eleventory.com`) and the subdomain pattern `{slug}.eleventory.com`.
3. Hosting: move from cPanel to a VPS (default) – required for wildcard/on-demand TLS, Redis workers.
4. Billing currency/gateway: BDT via SSLCommerz/bKash first; Stripe later.
5. Free trial length and plan tiers (suggest: Trial 14 days → Starter / Growth / Pro).
6. Who may sign up: anyone (default) with email + phone verification and abuse limits.
7. Is `STAFF_REGISTRATION` (current role-less sign-up) replaced by the merchant sign-up flow? (default: yes, sign-up always creates an organization + store.)

---

## 6. MASTER PROMPT (copy everything in the block below into a fresh Claude Code session)

```text
ROLE
You are the lead engineer converting "Eleventory" – a single-store ecommerce CMS – into a multi-tenant SaaS platform where anyone can sign up, get their own store (subdomain + optional custom domain), pay a subscription, and run their shop, like Shopify. You work autonomously, phase by phase, with tests, and never break the live store elevendollar.store.

PROJECT FACTS (read the repo first; do not assume)
- Repo: D:\xampp\htdocs\eleventory (branch claude/friendly-knuth-kqj7zw). backend/ = Laravel 13, PHP 8.4, Sanctum, spatie/laravel-permission, MariaDB. frontend/ = Next.js 16 (read node_modules/next/dist/docs before using any API; it has breaking changes), Tailwind v4, TanStack Query, react-hook-form + zod. mcp-server/ = MCP stdio server. Docs: ARCHITECTURE.md, DATABASE_DESIGN.md, API_DESIGN.md, DEVELOPMENT_ROADMAP.md, SAAS_PLAN.md (the plan/gap review – read it first).
- Schema is already multi-store: organizations → stores, store_id on ~49 tables with composite uniques. users.current_store_id + store_user pivot exist. Storefront currently resolves "first active store" (StorefrontController::currentStore).
- KNOWN CRITICAL GAP: controllers trust a client-sent store_id; there is no membership check, no global scope, roles are global. Fixing this is Phase 1 and blocks everything else.
- Live deploy today: cPanel shared hosting, no SSH; deploy/build-release.sh + deploy/upload-ftp.sh, extraction via cPanel File Manager API. See SAAS_PLAN.md §3 for the target VPS architecture. Never ask the user for passwords/tokens; the user types FTP passwords themselves.
- Local stack: XAMPP (php84 at /d/xampp/php84/php.exe), backend on :8000, frontend on :3000. Windows + Git Bash; use Edit/Write tools for content with backslashes.
- Conventions: match surrounding code style, ApiResponse envelope, FormRequests, Resources, Pint for PHP, ESLint + tsc for frontend, Pest/PHPUnit feature tests (currently ~580 passing; keep green).

NON-NEGOTIABLE RULES
1. Tenant isolation is a security boundary. Every tenant-owned model gets the BelongsToStore trait + global scope + auto store_id on create. No code path may read/write another tenant's data. Never accept store_id from the client for authorization – derive it from TenantContext (host for storefront, authenticated membership for admin).
2. Write tests first for isolation: a cross-tenant leak suite that creates two tenants and asserts, for EVERY route in routes/api.php (list/show/create/update/delete/export), that tenant A's user and tokens cannot see or change tenant B's data (expect 404/403). A new route without leak coverage fails CI.
3. Backwards compatible: elevendollar.store must keep working after each phase. Use the SAAS_MODE flag and additive migrations; backfill, then enforce. Provide down() for risky migrations and a rollback note.
4. Secrets: encrypt all third-party credentials at rest (encrypted casts), never log them, never return them from APIs (mask), rotate on tenant request.
5. Small, reviewable commits per phase step; update SAAS_PLAN.md checkboxes and the relevant docs; summarize what changed, what was verified, and what is left. Report test/lint output honestly; if something fails or is skipped, say so.
6. Ask me before: spending money, changing DNS/hosting, deleting data, force-pushing, anything outward-facing (emails to real users, public posts), or when a decision in SAAS_PLAN.md §5 is still unconfirmed and blocks you.
7. No dark patterns or scope creep: build only what each phase's acceptance criteria list.

HOW TO WORK
For each phase below: (a) restate acceptance criteria, (b) inspect the code and list the files you will touch, (c) implement with tests, (d) run backend tests + Pint + frontend tsc/eslint, (e) verify in the running app (browser) for UI work, (f) commit, (g) write a short phase report and STOP for my go-ahead before the next phase.

PHASES AND ACCEPTANCE CRITERIA
Phase 0 – Safety net: confirm decisions (SAAS_PLAN.md §5), add SAAS_MODE flag, set up a staging environment plan, snapshot baseline test results, add CI script that runs backend tests, Pint, tsc, eslint.

Phase 1 – Tenant isolation core:
 - TenantContext service (resolve from authenticated membership + selected store header/session for admin; from Host for storefront). Middleware stack: ResolveTenant, EnsureStoreMembership (user must be in store_user with active status; else 403).
 - BelongsToStore trait + TenantScope applied to all tenant models; creating hook sets store_id; a `withoutTenancy()` escape hatch used only by platform admin and console jobs, each use audited.
 - spatie teams enabled with team_foreign_key=store_id; migrate existing roles/permissions to per-store copies; platform_admin role outside teams; seeder creates default roles for each new store (owner, manager, staff, support, read-only).
 - Remove client-controlled store_id as an authority from every FormRequest/controller; keep it only as an optional hint validated against membership.
 - Sanctum tokens: abilities include store scope; MCP tokens bound to one store.
 - Cross-tenant leak test suite (Rule 2) + regression tests for existing behaviour.
 Done when: leak suite green over all routes, full suite green, elevendollar.store behaves identically.

Phase 2 – Sign-up and onboarding:
 - Public sign-up creates: user, organization, store (slug validated/reserved list, unique), owner membership + owner role, defaults (currency BDT/timezone/locale, default warehouse, standard pages, homepage blocks, sample category, notification defaults), trial subscription placeholder.
 - Email verification (reuse VerifyStaffEmailNotification) and optional phone OTP; abuse limits (per IP/email, disposable-email block, captcha hook).
 - Onboarding wizard in the admin: store name/logo, currency, first product, shipping zones, payment methods, domain; progress checklist; emails for each step.
 - Multi-store switcher for users in several stores.

Phase 3 – Multi-tenant storefront:
 - Resolve store by Host (subdomain + verified custom domain) in the API and in the Next.js storefront (middleware passes host; no NEXT_PUBLIC_SITE_URL assumptions). Cache keys, ISR tags, robots.txt, sitemap.xml, canonical/OG URLs, JSON-LD all per tenant.
 - Tenant-aware SSR key / rate limits; suspended or unknown hosts return a branded "unavailable" page with correct status.
 - Customer accounts/tokens bound to a store.

Phase 4 – Domains and TLS: custom-domain add + CNAME/TXT verification + status UI, on-demand TLS check endpoint for Caddy, www/apex redirects, domain limits per plan.

Phase 5 – Plans, billing, limits: plans table + feature/limit definitions, subscription state machine (trial/active/past_due/suspended/cancelled), enforcement middleware (products, staff seats, monthly orders, storage, domains, feature flags), billing page (usage, invoices, change plan), gateway integration with signed webhooks (SSLCommerz/bKash first, Stripe optional), dunning emails, grace period then storefront suspension (never data deletion).

Phase 6 – Platform super-admin: separate area/guard; tenant directory + search, plan override, suspend/restore, impersonation with audit trail and visible banner, MRR/churn/usage dashboards, abuse/report handling, platform-wide announcements, feature flags per tenant.

Phase 7 – Merchant payments: per-store payment gateway settings (SSLCommerz, bKash, Nagad, Stripe), encrypted credentials, hosted checkout redirect + webhook reconciliation into Payment rows, refunds, test mode.

Phase 8 – Infrastructure and scale: Docker/VPS deployment scripts, Caddy/Nginx, PHP-FPM, Node process manager, Redis cache + queues, Supervisor/Horizon workers + scheduler, S3/R2 media with tenants/{store_uuid}/ prefix, storage quotas, CDN, per-tenant rate limiting, daily encrypted backups + per-tenant restore drill, Sentry + uptime checks, SPF/DKIM guidance per sending domain, migration runbook from cPanel.

Phase 9 – Themes and customisation: theme presets (colours, fonts, layout variants), logo/favicon, homepage block templates per theme, sandboxed custom CSS, preview before publish.

Phase 10 – Compliance and launch: ToS/Privacy/DPA pages, tenant data export (zip/CSV) and account deletion with retention rules, audit log UI, transactional email templates, help centre skeleton, migrate elevendollar.store into the platform as tenant #1, closed beta checklist, load test, go-live runbook.

DEFINITION OF DONE (every phase)
- Acceptance criteria met and demonstrated (tests + manual/browser verification notes).
- Backend suite, Pint, frontend tsc + eslint all green; leak suite covers all routes.
- Docs updated (SAAS_PLAN.md, ARCHITECTURE.md/DATABASE_DESIGN.md where relevant), .env examples updated, migrations reversible or with documented rollback.
- Phase report posted; wait for my approval before continuing.

START NOW
Read SAAS_PLAN.md and the codebase areas named above, then give me: (1) a one-page confirmation of the facts and gaps you verified, (2) your questions on the unconfirmed decisions in §5, (3) the detailed work breakdown for Phase 0 and Phase 1. Do not write code until I answer.
```

---

## 7. Suggested first moves (this week)

1. Confirm the §5 decisions (especially hosting → VPS and the platform domain).
2. Start Phase 1 immediately; it is the prerequisite for everything and also hardens the current site.
3. Stand up a staging VPS in parallel so Phase 3/4 can be tested with real wildcard DNS and TLS.

---

## 8. Progress log

### Phase 1 – tenant isolation (in progress, started 2026-11-05)
Done (behind `SAAS_MODE`, default off, so the live single-store site is unchanged):
- [x] `TenantContext` + `BelongsToStore` trait + `TenantScope` on all 46 store-owned models (auto-filter, auto-stamp `store_id` on create)
- [x] `ResolveTenant` middleware (`tenant`) on every staff route: the store must be one the user is an active member of; naming another store is a 403; runs before route-model binding so foreign ids are 404
- [x] Store list/show/update/delete limited to member stores; only `Platform Admin` creates stores; user list/show/update/delete limited to the acting store
- [x] Users created from the Users screen join the creator's store; migration `2026_11_05_100000_backfill_store_user_membership` gives every existing user a membership
- [x] Storefront and customer requests set the tenant (storefront still resolves "first active store"; host resolution is Phase 3)
- [x] `TenantIsolationTest`: 12 tests incl. a route sweep that fails if any single-parameter staff route can reach another store's record

Also done (second pass):
- [x] Roles are shared templates: in `SAAS_MODE` only a `Platform Admin` can create/edit/delete roles; store staff can assign roles but cannot see or grant `Platform Admin` (checked before anything is written)
- [x] MCP connector tokens are pinned to the store they were created in (ability `store:<id>`); the bridge sends `X-Store-Id`, so membership is re-checked on every call and the token cannot follow the user into another store
- [x] Customer tokens: a customer's requests always run in the customer's own store (`EnsureCustomerUser`)
- [x] Write/nested sweep (`test_no_write_or_nested_route_can_reach_another_stores_record`): every verb, every parameter position of store-owned models (100 positions) must 404/403 and leave the foreign record intact. Variants and attribute values (no `store_id`) are guarded by their parent's ownership check; models without a factory (purchase returns, 404 logs, newsletter subscribers) are skipped by the sweep but carry the same scope

Deliberately deferred (decision, not an oversight):
- Per-store roles via spatie teams. It rewrites the live permission tables' primary keys and every role assignment, for little gain while roles are platform-managed templates. Known limit: a person who belongs to two stores has the same roles in both. Revisit if stores need custom roles (Phase 7+).

Before switching `SAAS_MODE=true` on live (checklist):
- [ ] Take a fresh backup (the Phase 0 backup was skipped)
- [ ] Deploy this build and run migration `2026_11_05_100000_backfill_store_user_membership`
- [ ] Confirm every staff user has an active `store_user` row, and the owner has the `Platform Admin` role
- [ ] Re-create existing MCP connections (old tokens have no store pin; they fall back to the user's current store)

### Phase 2 – sign-up & onboarding (backend + admin UI built 2026-11-06)
Built (behind `MERCHANT_SIGNUP`, default off, and only when `SAAS_MODE` is on, because a store owner's role would otherwise reach the single store's shared roles):
- [x] `POST /auth/signup` creates user + organization + store in one transaction (`StoreProvisioner`): owner membership + `Store Owner` role, BDT currency, main warehouse, "General" category, six standard pages, three homepage blocks, trial placeholder (`organizations.plan = trial`, `trial_ends_at`, `TRIAL_DAYS`)
- [x] Store address rules (`StoreSlug`): 3-40 chars, lowercase/digits/single hyphens, reserved list in `config/signup.php`, unique including soft-deleted stores; `GET /auth/slug-available` for live checking
- [x] Abuse limits: 5 sign-ups per hour per IP and 30 address checks per minute (named limiters; the `throttle:N,M` shorthand shares one counter per IP across routes), disposable-email block, terms must be accepted, `CaptchaVerifier` hook (default accepts everyone)
- [x] Email verification reuses `VerifyStaffEmailNotification`; the owner cannot sign in until verified
- [x] `GET /onboarding` checklist computed from real data (verify email, first product, delivery zones, store details, optional domain) + trial days left; shown on the dashboard until complete
- [x] Multi-store switcher: `GET /auth/my-stores`, `POST /auth/switch-store` (membership checked, same refusal for "not yours" and "does not exist"); topbar dropdown appears for people in 2+ stores
- [x] Tests: `MerchantSignupTest` (12). Verified in the browser: sign-up -> verify -> sign-in -> own empty store + checklist

Not built (decide or schedule):
- [ ] Phone OTP (the prompt says optional); needs an SMS budget decision
- [ ] A real captcha provider (Turnstile/hCaptcha) - needs an account and keys
- [ ] "Emails for each onboarding step" - needs templates and a scheduler; outward-facing, so not enabled without your say-so
- [ ] A multi-step wizard page; the checklist links into the existing screens instead
- [ ] Logo/currency/payment-method steps (payment methods arrive with Phase 7)
- [ ] The Terms/Privacy links in the form point nowhere until Phase 10 provides the pages
