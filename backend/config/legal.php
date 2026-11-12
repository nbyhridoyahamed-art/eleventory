<?php

return [
    /*
     * The version of the Terms of Service, Privacy Policy and Data Processing Agreement people must have
     * accepted. Keep equal to LEGAL_VERSION in frontend/src/lib/legal-docs.ts. Bump both when the wording
     * changes in a way people should re-accept: the dashboard then asks everyone to accept again.
     */
    'version' => env('LEGAL_VERSION', '2026-11-draft'),

    'documents' => ['terms', 'privacy', 'dpa'],
];
