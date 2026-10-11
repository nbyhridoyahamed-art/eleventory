<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Models\NotFoundLog;
use App\Models\SeoSetting;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Everything the public storefront needs to render a site's SEO: robots and
 * sitemap rules, schema options, verification tags, analytics IDs and the
 * homepage / blog landing page meta. All of it ends up in public HTML anyway,
 * so nothing here is secret.
 */
class SeoSettingController extends StorefrontController
{
    /** Upper bound on distinct missing URLs remembered per store. */
    private const MAX_404_ROWS = 5000;

    public function show(): JsonResponse
    {
        $store = $this->currentStore();
        $settings = SeoSetting::resolved($store);

        // The homepage falls back to the store's own SEO record (what the
        // homepage builder's SEO tab edits) wherever the SEO section left a field blank.
        $storeSeo = $store->seoMetadata;
        foreach (['title', 'description', 'focus_keyword', 'og_image'] as $field) {
            if (blank($settings['homepage'][$field] ?? null) && $storeSeo) {
                $settings['homepage'][$field] = $storeSeo->{$field};
            }
        }

        return ApiResponse::success([
            'store_name' => $store->name,
            'settings' => $settings,
        ], 'SEO settings fetched successfully.');
    }

    /**
     * Records a storefront 404 for the SEO section's 404 monitor. Called
     * server-to-server by the storefront when a page is missing and no redirect
     * matches. Static assets and framework paths are ignored, and the query
     * string is dropped so one broken link is one row.
     */
    public function notFound(Request $request): JsonResponse
    {
        // Only the storefront server reports misses; when a shared key is configured,
        // anonymous callers cannot fill the log with junk paths.
        $ssrKey = (string) config('app.ssr_key');

        if ($ssrKey !== '' && ! hash_equals($ssrKey, (string) $request->header('X-Storefront-Key'))) {
            return ApiResponse::success(message: 'Ignored.');
        }

        $data = $request->validate([
            'path' => ['required', 'string', 'max:500', 'regex:/^\//'],
            'referrer' => ['nullable', 'string', 'max:500'],
        ]);

        $path = '/'.ltrim(strtok($data['path'], '?#') ?: '/', '/');
        $path = mb_substr($path, 0, 500);

        if (preg_match('#^/(_next|api|storage)/|\.(js|css|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|txt|xml)$#i', $path)) {
            return ApiResponse::success(message: 'Ignored.');
        }

        $store = $this->currentStore();
        $hash = sha1($path);

        $log = NotFoundLog::query()->where('store_id', $store->id)->where('path_hash', $hash)->first();

        if ($log) {
            $log->update([
                'hits' => $log->hits + 1,
                'last_seen_at' => now(),
                'last_referrer' => $data['referrer'] ?? $log->last_referrer,
            ]);
        } elseif (NotFoundLog::query()->where('store_id', $store->id)->count() < self::MAX_404_ROWS) {
            // Bounded so a crawler hammering random URLs cannot grow the table without limit.
            NotFoundLog::create([
                'store_id' => $store->id,
                'path' => $path,
                'path_hash' => $hash,
                'hits' => 1,
                'last_referrer' => $data['referrer'] ?? null,
                'first_seen_at' => now(),
                'last_seen_at' => now(),
            ]);
        }

        return ApiResponse::success(message: 'Logged.');
    }
}
