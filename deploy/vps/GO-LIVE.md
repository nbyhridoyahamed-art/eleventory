# Go-live runbook (Phase 10)

Read together with `RUNBOOK.md` (how the servers are built) and `BETA-CHECKLIST.md` (who gets in first).
Nothing here has been run against a real server by the person who wrote it: rehearse every step on a spare
server with a **copy** of the live data before doing it for real. The live shop (elevendollar.store) must never
be the first place a step is tried.

## 0. Decisions only you can make
- [ ] Company legal name, address, contact emails, jurisdiction: fill `COMPANY` in `frontend/src/lib/legal-docs.ts`.
- [ ] A lawyer reviews Terms, Privacy Policy and DPA. They are drafts, not legal advice. Then set `LEGAL_VERSION`
      (backend env and `LEGAL_VERSION` in `legal-docs.ts`, same value, no longer containing "draft"). Bumping it later
      makes the dashboard ask every user to accept again.
- [ ] Real plan prices (the seeded ones are placeholders) and the billing gateway (`BILLING_GATEWAY`).
- [ ] Real SSLCommerz / Stripe sandbox runs for merchant payments (only faked HTTP so far).
- [ ] A support address that is monitored, and who answers it.

## 1. Preflight (run on the target server, with its real `.env`)
```bash
php artisan migrate --force
php artisan platform:preflight
```
`FAIL` lines block launch. `WARN` lines are judgement calls: read each one and either fix it or accept it knowingly.
It checks APP_DEBUG, key, database, mail driver, SAAS_MODE/PLATFORM_DOMAIN, custom-domain secrets, queue, backups,
scheduler heartbeat, error tracking, billing gateway, plans, legal placeholders, a platform admin, and that every
shop has a subscription.

Also run, and read the output of:
```bash
php artisan mail:preview          # writes HTML of each platform email to storage/app/mail-preview
php artisan account:purge --dry-run
php artisan tenant:export --all   # then: php artisan tenant:restore <file> --dry-run
```

## 2. Load test
`deploy/loadtest/storefront.k6.js` is a k6 script. It has **never been run** (k6 is not installed where it was written).
Run it against the rehearsal server, not production:
```bash
k6 run -e API=https://api.staging.example.com/api/v1 -e HOST=demo.staging.example.com deploy/loadtest/storefront.k6.js
```
Watch database CPU, queue depth and `/api/v1/health` while it runs. Decide your own pass mark first (for example p95
under 800 ms at the traffic you expect on launch day) and write it down.

## 3. elevendollar.store becomes tenant #1
The live shop already has an organization and store row (the Phase 0 migrations created them), and the billing
migration gave it the unlimited `legacy` ("Founding store") plan, so it keeps working without paying. The move:
1. Rehearse `RUNBOOK.md` section 8 end to end on a spare server with a copy of the live database.
2. On the copy: `php artisan platform:preflight` must show "Every shop belongs to an organization with a subscription" as PASS.
3. Check the copy: log in as the owner, open Settings > Billing (shows Founding store), Settings > Domains (the live
   domain is the primary domain), place a COD order, confirm the order email arrives.
4. Maintenance window per `RUNBOOK.md` section 8 (final dump, restore, migrate, DNS). Keep cPanel intact as rollback.
5. Only after a quiet week: set `SAAS_MODE=true`. That is a separate decision from moving servers.
6. Owner of the live shop: accept the legal documents once (the banner appears at next login).

## 4. Open the door
1. Closed beta first: `MERCHANT_SIGNUP=true` and `SIGNUP_INVITE_CODES=code1,code2`. See `BETA-CHECKLIST.md`.
2. Open sign-up (clear `SIGNUP_INVITE_CODES`) only after the beta exit criteria are met.
3. Announce via a platform announcement (Platform console > Announcements), not only email.

## 5. Day-of watchlist
- `/api/v1/health` from an external monitor, alerting to a phone.
- Failed jobs table, queue depth, mail bounces.
- Platform console: new tenants, abuse reports, suspended accounts.
- Daily `account:purge` runs at 04:00 (check its log once; the first real purge deletes data permanently).
- Backups: `backup.sh` ran last night and a restore drill passed this month.

## 6. Roll back
- Before opening sign-up: set `MERCHANT_SIGNUP=false`. Existing merchants are unaffected.
- A bad deploy: redeploy the previous image; migrations in this phase only add tables/columns (safe to leave).
- A bad purge (should be impossible inside the 14-day grace): restore the shop from its `tenant:export` file with
  `tenant:restore`. After the purge the data is gone by design, which is why exports exist.

## 7. Known gaps at launch (do not hide these)
- Legal texts are unreviewed drafts. Retention periods in them are placeholders until you confirm local law.
- Load test written, never run. Docker files untested on a server. Redis behaviour untested.
- Account deletion removes the database rows and files the platform knows about; it cannot remove copies already in
  your database backups (they age out under `BACKUP_RETENTION_DAYS`). Say that in your privacy policy.
- Shoppers' personal data inside a merchant's shop is the merchant's data (the merchant is the controller). A shopper
  asking *you* to delete their data has to be forwarded to the merchant; there is no shopper self-service export.
- No 2FA for platform admins. No SOC2/ISO. No data residency options.
- The merchant activity log covers staff, domain, payment-gateway, plan, billing, store-settings and data-export
  actions, not every product or order edit.
