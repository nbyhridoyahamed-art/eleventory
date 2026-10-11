<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A store's technical / site-wide SEO configuration, kept as one JSON document
 * (see the seo_settings migration). Always read through resolved(), which
 * layers what was saved over defaults(), so callers never see a missing key.
 */
#[Fillable(['store_id', 'data'])]
class SeoSetting extends Model
{
    protected function casts(): array
    {
        return ['data' => 'array'];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /** @return array<string, array<string, mixed>> */
    public static function defaults(): array
    {
        return [
            'site' => [
                'site_name' => null,
                'default_og_image' => null,
                'twitter_handle' => null,
            ],
            'homepage' => ['title' => null, 'description' => null, 'focus_keyword' => null, 'og_image' => null],
            'blog' => ['title' => null, 'description' => null, 'focus_keyword' => null, 'og_image' => null],
            // mode: default (standard rules) | custom (use `custom` verbatim) | block_all (noindex the whole site)
            'robots' => ['mode' => 'default', 'custom' => '', 'extra_disallow' => []],
            'sitemap' => [
                'enabled' => true,
                'products' => true,
                'categories' => true,
                'brands' => true,
                'pages' => true,
                'blog' => true,
            ],
            'schema' => [
                'organization' => true,
                'website_search' => true,
                'product' => true,
                'breadcrumb' => true,
                'blog' => true,
                'org_name' => null,
                'org_logo' => null,
                'org_phone' => null,
                'org_email' => null,
                'org_address' => null,
                'social_profiles' => [],
            ],
            'verification' => [
                'google' => null,
                'bing' => null,
                'yandex' => null,
                'pinterest' => null,
                'facebook' => null,
                'baidu' => null,
            ],
            'analytics' => ['ga4_id' => null, 'gtm_id' => null, 'meta_pixel_id' => null, 'clarity_id' => null],
            // IndexNow: a key file served at /<key>.txt proves ownership; see SeoToolsController.
            'indexnow' => ['key' => null],
        ];
    }

    /**
     * Saved settings layered over defaults. Lists (social_profiles,
     * extra_disallow) are replaced wholesale rather than merged by index.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function resolved(Store $store): array
    {
        $saved = static::query()->where('store_id', $store->id)->value('data');
        $saved = is_string($saved) ? (json_decode($saved, true) ?: []) : ($saved ?: []);

        $resolved = static::defaults();

        foreach ($resolved as $group => $values) {
            foreach ($values as $key => $default) {
                if (isset($saved[$group]) && array_key_exists($key, $saved[$group])) {
                    $resolved[$group][$key] = $saved[$group][$key];
                }
            }
        }

        return $resolved;
    }
}
