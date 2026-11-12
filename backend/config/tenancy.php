<?php

return [
    /* Custom domains one store may connect. */
    'max_domains' => (int) env('MAX_DOMAINS_PER_STORE', 5),

    /*
     * Where a custom domain must point: the hostname for a CNAME record, and/or the
     * server addresses for an A record. Empty = the DNS "points here" check is skipped.
     */
    'cname_target' => env('PLATFORM_CNAME_TARGET'),
    'server_ips' => array_values(array_filter(array_map('trim', explode(',', (string) env('PLATFORM_SERVER_IPS', ''))))),

    /*
     * Shared secret the TLS server (Caddy on-demand TLS "ask" URL) sends when it
     * asks whether it may obtain a certificate for a domain. Empty = always refuse.
     */
    'tls_ask_secret' => env('TLS_ASK_SECRET'),
];
