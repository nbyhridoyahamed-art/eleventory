<?php

return [
    /* Days between "delete my account" and the data really being deleted. The shop is offline meanwhile and the owner can cancel. */
    'deletion_grace_days' => (int) env('DELETION_GRACE_DAYS', 14),

    /* Days a data-export download stays available. */
    'export_expiry_days' => (int) env('EXPORT_EXPIRY_DAYS', 7),

    /* Minutes before the same shop may make another export (they are heavy). */
    'export_cooldown_minutes' => (int) env('EXPORT_COOLDOWN_MINUTES', 60),

    /* Days of merchant activity history kept. */
    'activity_retention_days' => (int) env('ACTIVITY_RETENTION_DAYS', 365),

    /*
     * Account-deletion and data-export emails to the owner. On by default because each one answers
     * something the owner just did and they need to know about it (unlike marketing or billing reminders).
     */
    'send_emails' => (bool) env('COMPLIANCE_EMAILS', true),
];
