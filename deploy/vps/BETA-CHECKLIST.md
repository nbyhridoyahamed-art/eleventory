# Closed beta checklist

Goal: 5 to 15 real merchants use the platform for 2 to 4 weeks before sign-up opens to everyone.

## Before inviting anyone
- [ ] `GO-LIVE.md` sections 0 and 1 done (preflight shows no FAIL).
- [ ] `MERCHANT_SIGNUP=true`, `SIGNUP_INVITE_CODES` set (one code per cohort so you can tell who came from where).
- [ ] A monitored support inbox and a place to log bugs (a spreadsheet is fine).
- [ ] You can answer: how does a merchant get a refund, how do they leave, who do they call when their shop is down?
- [ ] Test merchant journey yourself, with a fresh email, on the real server: sign up, verify email, onboarding
      checklist, add a product, place an order as a shopper, add a custom domain, choose a plan, download an export,
      cancel a scheduled deletion.
- [ ] Billing: either real sandbox payments tested, or `BILLING_GATEWAY=manual` and beta merchants told they are on a free trial.

## Who to invite
- Merchants you can phone or message directly; mix of one very small and one busy shop; at least one who wants a custom domain.
- Tell them plainly: beta, expect rough edges, data may be reset only with their permission, they can export or leave any time.

## While it runs (weekly)
- [ ] Read every support message and the failed-jobs table.
- [ ] Check the platform console: abuse reports, suspended accounts, trials about to end.
- [ ] Restore drill from last night's backup.
- [ ] Note every "how do I...?" question: each one is a missing help article (`frontend/src/lib/help-articles.ts`).

## Exit criteria (set your own numbers before starting)
- [ ] No data-leak or wrong-shop incident.
- [ ] No unresolved payment or order-loss bug.
- [ ] Load test run at expected launch traffic and passed.
- [ ] Legal texts reviewed and `LEGAL_VERSION` is no longer a draft.
- [ ] At least N merchants completed a real order through their own shop (N decided by you).
- [ ] Support load is manageable by whoever will actually do it.
