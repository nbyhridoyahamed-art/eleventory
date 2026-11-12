<?php

namespace App\Services\Tenancy;

use App\Models\Store;
use App\Models\StoreDomain;
use App\Support\ApiResponse;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;

/**
 * Works out which store a public storefront request is for, from the host the
 * shopper typed: a verified custom domain (`stores.domain`) or a platform
 * subdomain (`{slug}.{PLATFORM_DOMAIN}`).
 *
 * Returns the store whatever its status, so the caller can tell "no such shop"
 * (null) from "shop exists but is closed" (status != active).
 */
class StoreResolver
{
    /**
     * The active store a public request is for. Single-store mode (SAAS_MODE off,
     * the live site today) serves the one active store; SaaS mode resolves by
     * host: the storefront server forwards it as X-Store-Host, a browser calling
     * the API directly is identified by its Origin. Unknown host -> 404, closed
     * shop -> 503.
     */
    public function activeForRequest(Request $request): Store
    {
        if (! config('app.saas_mode')) {
            return Store::where('status', 'active')->firstOrFail();
        }

        $host = $request->header('X-Store-Host') ?: parse_url((string) $request->header('Origin'), PHP_URL_HOST);
        $store = $this->forHost($host ?: null);

        if (! $store) {
            throw new HttpResponseException(ApiResponse::error('Store not found.', ['code' => ['store_not_found']], 404));
        }

        if ($store->status !== 'active') {
            throw new HttpResponseException(ApiResponse::error('This store is not available right now.', ['code' => ['store_unavailable']], 503));
        }

        return $store;
    }

    public function forHost(?string $host): ?Store
    {
        $host = $this->normalise($host);

        if ($host === null) {
            return null;
        }

        // A verified custom domain, with or without the leading "www.". Only `active` rows
        // count: a claim nobody has proven routes nothing.
        $variants = $this->variants($host);
        $storeId = StoreDomain::withoutGlobalScopes()->whereIn('active_domain', $variants)->value('store_id');
        $store = $storeId ? Store::query()->find($storeId) : null;

        // Older single-domain value (kept in step with the primary domain).
        $store ??= Store::query()->whereIn('domain', $variants)->first();

        if ($store) {
            return $store;
        }

        $slug = $this->platformSlug($host);

        return $slug === null ? null : Store::query()->where('slug', $slug)->first();
    }

    /** The host written with and without "www.": both belong to whoever owns either. */
    public function variants(string $host): array
    {
        $bare = str_starts_with($host, 'www.') ? substr($host, 4) : $host;

        return array_values(array_unique([$host, $bare, 'www.'.$bare]));
    }

    /**
     * The one address the store should be reached at: its primary connected custom domain,
     * or null when it only has the free address (nothing to redirect to).
     */
    public function canonicalHost(Store $store): ?string
    {
        return StoreDomain::withoutGlobalScopes()
            ->where('store_id', $store->id)->where('status', StoreDomain::ACTIVE)->where('is_primary', true)
            ->value('domain');
    }

    /** Lower-case, no scheme, port, path or trailing dot; null when nothing usable is left. */
    public function normalise(?string $host): ?string
    {
        $host = strtolower(trim((string) $host));
        $host = preg_replace('#^[a-z][a-z0-9+.-]*://#', '', $host) ?? '';
        $host = explode('/', $host, 2)[0];
        $host = preg_replace('/:\d+$/', '', $host) ?? '';
        $host = rtrim($host, '.');

        return $host === '' || ! preg_match('/^[a-z0-9.-]+$/', $host) ? null : $host;
    }

    /** The store address in `{slug}.{platform domain}`, or null when the host is not a one-label subdomain of the platform. */
    private function platformSlug(string $host): ?string
    {
        $platform = $this->normalise(config('app.platform_domain'));

        if ($platform === null || ! str_ends_with($host, '.'.$platform)) {
            return null;
        }

        $label = substr($host, 0, -strlen('.'.$platform));

        return $label !== '' && ! str_contains($label, '.') ? $label : null;
    }
}
