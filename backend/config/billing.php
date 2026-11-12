<?php

return [
    /*
     * How subscriptions are paid: "fake" (local/dev: a fake checkout page, never for production),
     * "sslcommerz" (BDT cards, bKash, Nagad through the platform's own SSLCommerz account) or
     * "manual" (no online checkout: the platform records a bank/bKash transfer by hand). The
     * safe default is manual, so nothing tries to charge anyone until a gateway is configured.
     */
    'gateway' => env('BILLING_GATEWAY', 'manual'),

    /* Which plan's limits and features apply while an account is still on its free trial. */
    'trial_plan' => env('BILLING_TRIAL_PLAN', 'growth'),

    /* Days an account keeps working after a payment is missed, before its shops go offline. */
    'grace_days' => (int) env('BILLING_GRACE_DAYS', 3),

    /* Days before a trial or period ends that a reminder is sent. */
    'reminder_days' => [3, 1],

    /*
     * Reminder, invoice and suspension emails to shop owners. Off until you decide to send them:
     * these are outward-facing messages to real people.
     */
    'send_emails' => (bool) env('BILLING_EMAILS', false),

    /*
     * Orders per month: false = shoppers can always check out and the owner is nudged to upgrade;
     * true = checkout is refused once the plan's monthly order limit is reached.
     */
    'hard_order_limit' => (bool) env('BILLING_HARD_ORDER_LIMIT', false),

    'invoice_prefix' => env('BILLING_INVOICE_PREFIX', 'INV'),

    'sslcommerz' => [
        'store_id' => env('SSLCOMMERZ_STORE_ID'),
        'store_password' => env('SSLCOMMERZ_STORE_PASSWORD'),
        'sandbox' => (bool) env('SSLCOMMERZ_SANDBOX', true),
    ],
];
