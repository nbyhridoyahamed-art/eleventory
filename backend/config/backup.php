<?php

return [
    /*
     * Key that encrypts per-tenant export files (php artisan tenant:export). Same format as APP_KEY
     * ("base64:..."). Leave empty to use APP_KEY. Keep it somewhere other than the server that holds
     * the backups, or the backups are only as safe as that server.
     */
    'key' => env('BACKUP_ENCRYPTION_KEY'),

    /* Nightly export of every shop (03:30) into storage/app/backups/tenants, keeping this many days. */
    'tenant_exports' => (bool) env('BACKUP_TENANT_EXPORTS', false),
    'retention_days' => (int) env('BACKUP_RETENTION_DAYS', 14),
];
