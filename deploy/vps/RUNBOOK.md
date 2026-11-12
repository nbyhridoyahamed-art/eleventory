# Eleventory SaaS: VPS runbook (Phase 8)

Status: written and reviewed, **not yet run on a real server**. The Docker files were never started
(no Docker on the build machine). Treat the first deploy as a rehearsal on a throwaway VPS, not the
live move.

The live shop (elevendollar.store on cPanel) is untouched by anything here.

## 1. What runs where

| Service | Image / source | Notes |
|---|---|---|
| caddy | caddy:2 | HTTPS for the platform names, `*.platform` store addresses and merchants' custom domains (on-demand TLS, approved by `/api/v1/internal/tls-ask`) |
| web | `frontend/Dockerfile` | Next.js standalone, `MULTI_STORE=true` |
| api | `backend/Dockerfile` | nginx + php-fpm, runs migrations on boot |
| worker | same image | `queue:work` on Redis |
| scheduler | same image | `schedule:work`: billing, scheduled homepage blocks, health heartbeat, nightly shop exports |
| mariadb, redis | official images | data in named volumes |

Sizing to start: 4 GB RAM / 2 vCPU / 80 GB disk handles a few hundred small shops. Watch MariaDB
memory and the `storage` volume first.

## 2. First deploy (rehearsal server)

1. A fresh Ubuntu LTS VPS, Docker + compose plugin, firewall allowing 22, 80, 443 only.
2. DNS: `A eleventory.com`, `A app.`, `A api.`, and `A *.eleventory.com` to the server (wildcard for free store addresses).
3. `git clone`, `cd deploy/vps`, `cp .env.example .env`, fill every blank (the comments say how).
4. `docker compose up -d --build`, then `docker compose logs -f api` until migrations finish.
5. `docker compose exec api php artisan platform:grant you@example.com` after creating that account.
6. Checks: `https://api.<domain>/api/v1/health` returns `{"status":"ok"}` with `database`, `cache`, `queue`, `scheduler` all true; sign up a test shop; open `https://<slug>.<domain>`; upload an image (see §4).

Deploying a new version: `git pull && docker compose up -d --build`. The api container migrates on boot, so
**take a backup first** (§6) and never deploy a migration you have not run on a copy of production data.

## 3. Rate limits (per shop)

`TENANT_REQUESTS_PER_MINUTE` (default 600) is the budget all of one shop's signed-in users share, on top
of the existing per-user 60/min. Limits are held in Redis, so they apply across all api containers. Known
gap: shoppers on a storefront are limited per IP only, not per shop; put Cloudflare rate-limiting rules
in front for that if a shop is attacked.

## 4. Media: tenant folders, quota, S3 / R2, CDN

- With `SAAS_MODE=true` every new upload goes to `tenants/{store_uuid}/<folder>/<uuid>.<ext>`. Files
  uploaded earlier keep their old path and keep working.
- The plan's `storage_mb` limit is checked before the file is written (HTTP 402 `plan_limit_reached`,
  `resource: storage_mb`). Placeholders: Starter 1 GB, Growth 10 GB, Pro 50 GB; edit in the platform plan editor.
- Default is the server disk. To use a bucket: create an R2/S3 bucket with public read (or a CDN in
  front), set `MEDIA_DISK=s3` and the `AWS_*` values, and set `AWS_URL` to the CDN address. Only **new**
  uploads move; to move old files copy `storage/app/public/` into the bucket with the same keys
  (`rclone copy`) and the database needs no change for tenant paths, but the old un-prefixed paths are
  looked up on the *public* disk, so keep that volume until you have migrated them (a one-off script
  that rewrites `media.disk`/`path` is NOT written yet).
- CDN: put Cloudflare (or any CDN) in front of the bucket and of `web`; cache `/_next/static/*` and
  `/storage/*` for a long time, never `/api/*`.

## 5. Monitoring

- Uptime: point UptimeRobot / Better Stack at `https://api.<domain>/api/v1/health` (expects 200; 503 means a
  named check failed) and at a store page. Alert by email/SMS to someone who will see it.
- Errors: `docker compose exec api composer require sentry/sentry-laravel`, set `SENTRY_LARAVEL_DSN`,
  rebuild. Code is already wired and does nothing until the package is installed. Add `@sentry/nextjs`
  to the frontend separately (not wired).
- Logs go to stderr: `docker compose logs api worker scheduler`.
- Failed jobs: `docker compose exec api php artisan queue:failed`.

## 6. Backups and the restore drill

Two layers, because they answer different questions:

1. **Whole database, nightly:** `backup.sh` (cron entry in the file). Gzip + AES-256, verified to end with
   "Dump completed", pruned after `BACKUP_RETENTION_DAYS`, copied off-server if `BACKUP_REMOTE` is set.
   This is what you restore after losing the server.
2. **One shop, nightly (and on demand):** `php artisan tenant:export {id|uuid}` or `--all`
   (scheduled at 03:30 when `BACKUP_TENANT_EXPORTS=true`). Encrypted with `BACKUP_ENCRYPTION_KEY`
   (APP_KEY if unset). Use it to rebuild one shop without touching the others.
   It contains the shop's rows and child rows; **not** uploaded files (listed by path in the file;
   they are the bucket / `storage` volume, back those up with rclone or provider versioning), **not**
   the owner's user account, plan or subscription.

Per-shop restore: `php artisan tenant:restore <file> [--replace]`. All or nothing, refuses to overwrite a
shop that has data unless `--replace`. The owner's user row must still exist.

**Drill, monthly, and after every migration that adds a table:**

```
php artisan tenant:export 1 --out=/tmp/drill.tenant
php artisan tenant:restore /tmp/drill.tenant --replace --dry-run     # restores, then rolls back
```

`--dry-run` proves the file decrypts, passes its row-count check and re-inserts cleanly against the live
schema, without changing data. Then, on a scratch server, restore the latest `backup.sh` dump with the
command in that file's header and open a shop. A backup never restored is a hope, not a backup.
A test (`InfrastructureTest`) fails when a new table is not covered by shop exports.

Keep `BACKUP_ENCRYPTION_KEY`, `BACKUP_PASSPHRASE` and `APP_KEY` somewhere other than the server. Encrypted
columns (payment gateway credentials) are encrypted with `APP_KEY`: lose it and they are unreadable.

## 7. Email: SPF, DKIM, DMARC

Today all mail (order emails, billing notices) is sent through the one mail configuration of the platform,
so authenticate **that** domain:

- SPF: one TXT on the sending domain listing your mail provider, e.g. `v=spf1 include:<provider> -all`
  (only one SPF record per domain).
- DKIM: the provider gives a selector + public key; publish it as a TXT/CNAME and wait until the provider shows "verified".
- DMARC: start with `v=DMARC1; p=none; rua=mailto:dmarc@<domain>`, read the reports for two weeks, then move to `quarantine`.
- Use a subdomain for platform mail (`mail.eleventory.com`) so a reputation problem there never affects the main domain.

Not built: per-merchant sending domains (a shop sending as `orders@theirshop.com`). When that arrives, each
shop would publish its own SPF/DKIM records from a Settings screen. Until then mail comes from the platform
address with the shop's name and a reply-to.

## 8. Moving the live shop from cPanel (when, and only when, you decide)

Not a Phase 8 deliverable to execute; the safe sequence is:

1. Rehearse §2 on a spare server with a **copy** of the live database (`mysqldump`, restore, `migrate`).
   Run `tenant:restore --dry-run` and click through admin, checkout and a payment in test mode.
2. Copy `storage/app/public` to the new server (or the bucket). Keep the same relative paths.
3. Lower DNS TTL to 300 s a day ahead.
4. Maintenance window: put cPanel into maintenance, final `mysqldump`, restore, `php artisan migrate`, switch DNS
   (`elevendollar.store` and `api.` to the new server; add it as the shop's primary domain), confirm
   `/api/v1/health`, place a COD order, check the confirmation email.
5. Keep cPanel untouched and intact for at least a week as the rollback (point DNS back; orders taken on the
   new server in the meantime would have to be exported, so keep the window short and quiet).
6. Only then switch `SAAS_MODE=true` and open sign-up, as a separate decision.

## 9. Known gaps (be honest with yourself before launch)

- Docker files and `backup.sh` are untested on a real host.
- Redis behaviour (queues, limiter, sessions) is not covered by the automated tests (they use the array driver).
- No Horizon dashboard (plain `queue:work`); no autoscaling; one database server, no replica.
- Old (un-prefixed) media is not migrated to tenant folders or a bucket by any script.
- Shop exports are built in memory: fine for thousands of products, not for a shop with millions of rows.
- Per-merchant sending domains, per-shop storefront rate limits and Sentry for the frontend are not built.
