<?php

namespace App\Services\Tenancy;

/**
 * The DNS questions domain verification asks. A class of its own so tests can
 * swap in canned answers instead of querying the real internet.
 */
class DnsChecker
{
    /** Every TXT string published at $name (empty when none or the lookup fails). */
    public function txt(string $name): array
    {
        $records = @dns_get_record($name, DNS_TXT);

        if (! is_array($records)) {
            return [];
        }

        return array_values(array_filter(array_map(
            fn ($record) => isset($record['txt']) ? trim((string) $record['txt']) : (isset($record['entries']) ? trim(implode('', $record['entries'])) : null),
            $records,
        ), fn ($value) => $value !== null && $value !== ''));
    }

    /** Whether $domain's CNAME is $target, or its A records include one of $ips. */
    public function pointsTo(string $domain, ?string $target, array $ips = []): ?bool
    {
        if (! $target && ! $ips) {
            return null;
        }

        if ($target) {
            $cnames = @dns_get_record($domain, DNS_CNAME);

            foreach (is_array($cnames) ? $cnames : [] as $record) {
                if (strcasecmp(rtrim((string) ($record['target'] ?? ''), '.'), rtrim($target, '.')) === 0) {
                    return true;
                }
            }
        }

        if ($ips) {
            $a = @dns_get_record($domain, DNS_A);

            foreach (is_array($a) ? $a : [] as $record) {
                if (in_array($record['ip'] ?? null, $ips, true)) {
                    return true;
                }
            }
        }

        return false;
    }
}
