<?php

return [
    /*
     * Slugs nobody may take as a store address: they would collide with the
     * platform's own hosts, routes or look like official accounts.
     */
    'reserved_slugs' => [
        'www', 'app', 'api', 'admin', 'administrator', 'root', 'platform', 'dashboard', 'login', 'logout',
        'register', 'signup', 'sign-up', 'account', 'accounts', 'billing', 'support', 'help', 'status',
        'mail', 'email', 'smtp', 'ftp', 'cdn', 'static', 'assets', 'media', 'files', 'img', 'images',
        'blog', 'docs', 'store', 'stores', 'shop', 'shops', 'checkout', 'cart', 'staging', 'dev', 'test',
        'demo', 'eleventory', 'elevendollar', 'security', 'abuse', 'postmaster', 'webmaster', 'noreply',
    ],

    /* Throwaway-mailbox domains refused at sign-up. Extend as abuse shows up. */
    'disposable_domains' => [
        'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', '10minutemail.com', 'tempmail.com',
        'temp-mail.org', 'yopmail.com', 'trashmail.com', 'getnada.com', 'sharklasers.com', 'dispostable.com',
        'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mintemail.com', 'mohmal.com',
    ],
];
