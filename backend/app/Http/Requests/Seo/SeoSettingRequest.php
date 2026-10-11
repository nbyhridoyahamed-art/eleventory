<?php

namespace App\Http\Requests\Seo;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SeoSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // seo.manage is checked in the controller, like StoreSeoController
    }

    public function rules(): array
    {
        // Verification tokens and tracking IDs are echoed into <meta> tags and
        // script URLs, so they are limited to the characters those IDs really use.
        $token = ['nullable', 'string', 'max:200', 'regex:/^[A-Za-z0-9_\-:.=]*$/'];
        $url = ['nullable', 'string', 'max:2048', 'url'];
        $text = fn (int $max) => ['nullable', 'string', 'max:'.$max];

        return [
            'store_id' => ['required', 'exists:stores,id'],
            'settings' => ['required', 'array'],

            'settings.site.site_name' => $text(120),
            'settings.site.default_og_image' => $url,
            'settings.site.twitter_handle' => ['nullable', 'string', 'max:60', 'regex:/^@?[A-Za-z0-9_]*$/'],

            'settings.homepage.title' => $text(255),
            'settings.homepage.description' => $text(500),
            'settings.homepage.focus_keyword' => $text(120),
            'settings.homepage.og_image' => $url,

            'settings.blog.title' => $text(255),
            'settings.blog.description' => $text(500),
            'settings.blog.focus_keyword' => $text(120),
            'settings.blog.og_image' => $url,

            'settings.robots.mode' => ['sometimes', Rule::in(['default', 'custom', 'block_all'])],
            'settings.robots.custom' => $text(5000),
            'settings.robots.extra_disallow' => ['sometimes', 'array', 'max:50'],
            'settings.robots.extra_disallow.*' => ['string', 'max:200', 'regex:/^\/[^\s]*$/'],

            'settings.sitemap.enabled' => ['sometimes', 'boolean'],
            'settings.sitemap.products' => ['sometimes', 'boolean'],
            'settings.sitemap.categories' => ['sometimes', 'boolean'],
            'settings.sitemap.brands' => ['sometimes', 'boolean'],
            'settings.sitemap.pages' => ['sometimes', 'boolean'],
            'settings.sitemap.blog' => ['sometimes', 'boolean'],

            'settings.schema.organization' => ['sometimes', 'boolean'],
            'settings.schema.website_search' => ['sometimes', 'boolean'],
            'settings.schema.product' => ['sometimes', 'boolean'],
            'settings.schema.breadcrumb' => ['sometimes', 'boolean'],
            'settings.schema.blog' => ['sometimes', 'boolean'],
            'settings.schema.org_name' => $text(120),
            'settings.schema.org_logo' => $url,
            'settings.schema.org_phone' => $text(40),
            'settings.schema.org_email' => ['nullable', 'email', 'max:190'],
            'settings.schema.org_address' => $text(300),
            'settings.schema.social_profiles' => ['sometimes', 'array', 'max:12'],
            'settings.schema.social_profiles.*' => ['string', 'max:2048', 'url'],

            'settings.verification.google' => $token,
            'settings.verification.bing' => $token,
            'settings.verification.yandex' => $token,
            'settings.verification.pinterest' => $token,
            'settings.verification.facebook' => $token,
            'settings.verification.baidu' => $token,

            'settings.analytics.ga4_id' => ['nullable', 'string', 'max:30', 'regex:/^(G-[A-Za-z0-9]{4,})?$/'],
            'settings.analytics.gtm_id' => ['nullable', 'string', 'max:30', 'regex:/^(GTM-[A-Za-z0-9]{4,})?$/'],
            'settings.analytics.meta_pixel_id' => ['nullable', 'string', 'max:30', 'regex:/^[0-9]*$/'],
            'settings.indexnow.key' => ['nullable', 'string', 'max:64', 'regex:/^[a-f0-9]{8,64}$/'],
            'settings.analytics.clarity_id' => ['nullable', 'string', 'max:30', 'regex:/^[A-Za-z0-9]*$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'settings.analytics.ga4_id.regex' => 'A GA4 measurement ID looks like G-XXXXXXXXXX.',
            'settings.analytics.gtm_id.regex' => 'A Tag Manager ID looks like GTM-XXXXXXX.',
            'settings.analytics.meta_pixel_id.regex' => 'A Meta Pixel ID is numeric.',
            'settings.robots.extra_disallow.*.regex' => 'Disallow paths must start with a slash, e.g. /private.',
        ];
    }
}
