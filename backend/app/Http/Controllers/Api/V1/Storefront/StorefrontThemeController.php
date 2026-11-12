<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Models\StoreTheme;
use App\Services\Themes\ThemeService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The published theme, or, for someone holding the unlisted preview token, the draft. A wrong or
 * missing token silently gets the published theme: nobody can tell whether a draft exists.
 */
class StorefrontThemeController extends StorefrontController
{
    public function __construct(private ThemeService $themes) {}

    public function show(Request $request): JsonResponse
    {
        $store = $this->currentStore();
        $theme = StoreTheme::query()->withoutGlobalScopes()->where('store_id', $store->id)->first();
        $token = (string) $request->query('preview', '');

        $preview = $theme && $token !== '' && hash_equals((string) $theme->getRawOriginal('preview_token'), $token);
        $config = $theme ? ($preview ? $theme->draft : $theme->published) : null;

        $response = ApiResponse::success($this->themes->publicPayload($store->id, $config), 'Theme fetched successfully.');

        // A draft must never be cached by a CDN or the browser.
        return $preview ? $response->header('Cache-Control', 'no-store, private') : $response;
    }
}
