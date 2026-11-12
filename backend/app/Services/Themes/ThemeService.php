<?php

namespace App\Services\Themes;

use App\Models\Media;
use App\Models\Store;
use App\Models\StoreTheme;
use App\Services\Billing\PlanLimits;
use App\Services\Tenancy\StoreResolver;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Themes are data, not code. A theme is a handful of validated choices (two colours, corner style, a
 * font from a fixed list, a few switches, a logo and favicon) that become CSS variables on the
 * storefront, plus optional merchant CSS that is filtered hard (see sanitizeCss). Nothing a merchant
 * types is ever executed or fetched from elsewhere.
 */
class ThemeService
{
    public const PRESETS = [
        'classic' => ['name' => 'Classic', 'blurb' => 'Clean and bright (the standard look)', 'colors' => ['nav' => '#0b3f91', 'accent' => '#ffa800'], 'radius' => 'soft', 'font' => 'inter'],
        'midnight' => ['name' => 'Midnight', 'blurb' => 'Dark and bold', 'colors' => ['nav' => '#0f172a', 'accent' => '#f59e0b'], 'radius' => 'sharp', 'font' => 'inter'],
        'bazaar' => ['name' => 'Bazaar', 'blurb' => 'Warm and busy', 'colors' => ['nav' => '#9a3412', 'accent' => '#fbbf24'], 'radius' => 'round', 'font' => 'rounded'],
        'fresh' => ['name' => 'Fresh', 'blurb' => 'Green and friendly', 'colors' => ['nav' => '#166534', 'accent' => '#facc15'], 'radius' => 'soft', 'font' => 'system'],
        'boutique' => ['name' => 'Boutique', 'blurb' => 'Quiet and elegant', 'colors' => ['nav' => '#1f2937', 'accent' => '#e11d48'], 'radius' => 'sharp', 'font' => 'serif'],
    ];

    /** Fixed font stacks: nothing is downloaded, and a merchant cannot name an arbitrary font. null = the built-in font. */
    public const FONTS = [
        'inter' => ['label' => 'Inter (standard)', 'stack' => null],
        'system' => ['label' => 'System (fast, native)', 'stack' => 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'],
        'serif' => ['label' => 'Serif (Georgia)', 'stack' => 'Georgia, "Times New Roman", serif'],
        'rounded' => ['label' => 'Rounded', 'stack' => 'ui-rounded, "Nunito", "Segoe UI", system-ui, sans-serif'],
    ];

    public const RADII = [
        'sharp' => ['--radius-sm' => '2px', '--radius-md' => '3px', '--radius-lg' => '4px'],
        'soft' => ['--radius-sm' => '6px', '--radius-md' => '8px', '--radius-lg' => '12px'],
        'round' => ['--radius-sm' => '10px', '--radius-md' => '14px', '--radius-lg' => '20px'],
    ];

    public const MAX_CSS_BYTES = 20000;

    public function __construct(private PlanLimits $limits, private StoreResolver $resolver) {}

    public function defaultConfig(): array
    {
        $classic = self::PRESETS['classic'];

        return [
            'preset' => 'classic', 'colors' => $classic['colors'], 'radius' => $classic['radius'], 'font' => $classic['font'],
            'topbar' => true, 'logo_media_id' => null, 'favicon_media_id' => null, 'custom_css' => null,
        ];
    }

    /** The row for a store, created on first use with the standard look as its draft. */
    public function forStore(int $storeId): StoreTheme
    {
        return StoreTheme::query()->withoutGlobalScopes()->firstOrCreate(
            ['store_id' => $storeId],
            ['draft' => $this->clean($this->defaultConfig()), 'published' => null, 'preview_token' => Str::random(40)],
        );
    }

    /** Only known keys, defaults for the rest. Input is assumed already validated by the request. */
    public function clean(array $input): array
    {
        $default = $this->defaultConfig();
        $preset = isset(self::PRESETS[$input['preset'] ?? '']) ? $input['preset'] : 'classic';

        return [
            'preset' => $preset,
            'colors' => ['nav' => strtolower($input['colors']['nav'] ?? $default['colors']['nav']), 'accent' => strtolower($input['colors']['accent'] ?? $default['colors']['accent'])],
            'radius' => isset(self::RADII[$input['radius'] ?? '']) ? $input['radius'] : $default['radius'],
            'font' => isset(self::FONTS[$input['font'] ?? '']) ? $input['font'] : $default['font'],
            'topbar' => (bool) ($input['topbar'] ?? true),
            'logo_media_id' => isset($input['logo_media_id']) ? (int) $input['logo_media_id'] : null,
            'favicon_media_id' => isset($input['favicon_media_id']) ? (int) $input['favicon_media_id'] : null,
            'custom_css' => isset($input['custom_css']) && trim((string) $input['custom_css']) !== '' ? (string) $input['custom_css'] : null,
        ];
    }

    public function hasUnpublishedChanges(StoreTheme $theme): bool
    {
        return $theme->draft !== ($theme->published ?? $this->clean($this->defaultConfig()));
    }

    public function publish(StoreTheme $theme): StoreTheme
    {
        $theme->update(['published' => $theme->draft, 'published_at' => now(), 'preview_token' => Str::random(40)]);

        return $theme;
    }

    public function discard(StoreTheme $theme): StoreTheme
    {
        $theme->update(['draft' => $theme->published ?? $this->clean($this->defaultConfig())]);

        return $theme;
    }

    /** What the storefront receives. $config null = the standard look. */
    public function publicPayload(int $storeId, ?array $config): array
    {
        if ($config === null) {
            return ['vars' => [], 'font_stack' => null, 'topbar' => true, 'custom_css' => null, 'logo_url' => null, 'favicon_url' => null];
        }

        $organization = $this->limits->organizationForStore($storeId);
        // A shop that dropped to a plan without custom CSS keeps its theme but loses the CSS.
        $cssAllowed = ! $organization || $this->limits->feature($organization, 'custom_css');

        return [
            'vars' => $this->vars($config),
            'font_stack' => self::FONTS[$config['font']]['stack'] ?? null,
            'topbar' => (bool) $config['topbar'],
            'custom_css' => $cssAllowed ? $config['custom_css'] : null,
            'logo_url' => $this->mediaUrl($storeId, $config['logo_media_id'] ?? null),
            'favicon_url' => $this->mediaUrl($storeId, $config['favicon_media_id'] ?? null),
        ];
    }

    public function publishedLogoUrl(int $storeId): ?string
    {
        $published = StoreTheme::query()->withoutGlobalScopes()->where('store_id', $storeId)->value('published');

        return $published ? $this->mediaUrl($storeId, $published['logo_media_id'] ?? null) : null;
    }

    private function mediaUrl(int $storeId, ?int $mediaId): ?string
    {
        if (! $mediaId) {
            return null;
        }

        // Only the shop's own files, whatever id the draft holds.
        $media = Media::query()->withoutGlobalScopes()->where('store_id', $storeId)->find($mediaId);

        return $media ? \App\Support\MediaLibrary::url($media->path) : null;
    }

    /** The storefront's public address, for the preview link. */
    public function storefrontUrl(Store $store): string
    {
        $front = parse_url((string) config('app.frontend_url')) ?: [];
        $scheme = $front['scheme'] ?? 'https';

        if (! config('app.saas_mode')) {
            return rtrim((string) config('app.frontend_url'), '/');
        }

        $custom = $this->resolver->canonicalHost($store);

        if ($custom) {
            return 'https://'.$custom;
        }

        $platform = (string) config('app.platform_domain');
        $host = $store->slug.'.'.$platform;
        // Local development address: keep the dev server's port.
        $port = str_ends_with($platform, 'localhost') && isset($front['port']) ? ':'.$front['port'] : '';

        return $scheme.'://'.$host.$port;
    }

    // ---- colour maths: text colours that always stay readable ----------------------------------

    public function vars(array $config): array
    {
        $nav = $config['colors']['nav'];
        $accent = $config['colors']['accent'];
        $onNav = $this->readableOn($nav);
        $onAccent = $this->readableOn($accent);

        // The brand "ink" colour is used as text on white, so it has to be dark enough on its own.
        $ink = $nav;
        for ($i = 0; $i < 12 && $this->contrast($ink, '#ffffff') < 4.5; $i++) {
            $ink = $this->mix($ink, '#000000', 0.12);
        }

        return [
            '--color-shop-nav' => $nav,
            '--color-shop-on-nav' => $onNav,
            '--color-shop-on-nav-muted' => $this->mix($onNav, $nav, 0.28),
            '--color-shop-accent' => $accent,
            '--color-shop-accent-hover' => $this->mix($accent, '#000000', 0.1),
            '--color-shop-on-accent' => $onAccent,
            '--color-shop-ink' => $ink,
            '--color-shop-tint' => $this->mix($nav, '#ffffff', 0.96),
        ] + self::RADII[$config['radius']];
    }

    /** White or near-black, whichever reads better on $background. */
    private function readableOn(string $background): string
    {
        return $this->contrast('#ffffff', $background) >= $this->contrast('#0f172a', $background) ? '#ffffff' : '#0f172a';
    }

    private function rgb(string $hex): array
    {
        $hex = ltrim($hex, '#');

        return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
    }

    private function luminance(string $hex): float
    {
        [$r, $g, $b] = array_map(function ($c) {
            $c /= 255;

            return $c <= 0.03928 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4;
        }, $this->rgb($hex));

        return 0.2126 * $r + 0.7152 * $g + 0.0722 * $b;
    }

    public function contrast(string $a, string $b): float
    {
        [$hi, $lo] = [max($this->luminance($a), $this->luminance($b)), min($this->luminance($a), $this->luminance($b))];

        return ($hi + 0.05) / ($lo + 0.05);
    }

    /** $weight of $towards mixed into $from. */
    private function mix(string $from, string $towards, float $weight): string
    {
        $a = $this->rgb($from);
        $b = $this->rgb($towards);

        return sprintf('#%02x%02x%02x', ...array_map(fn ($i) => (int) round($a[$i] * (1 - $weight) + $b[$i] * $weight), [0, 1, 2]));
    }

    // ---- merchant CSS ---------------------------------------------------------------------------

    /**
     * Returns the CSS with comments removed, or throws a validation error saying what is not allowed.
     *
     * The rule is deliberately blunt: a stylesheet that cannot load anything, cannot contain markup, and
     * cannot hide what it does behind escapes is a stylesheet we can serve safely. It cannot run code
     * (CSS has none), cannot fetch files or fonts from other sites (no url(), no @import, no @font-face:
     * a shopper's address is never sent to a third party), and cannot break out of its <style> tag.
     */
    public function sanitizeCss(string $css): string
    {
        $fail = fn (string $message) => throw ValidationException::withMessages(['custom_css' => $message]);

        if (strlen($css) > self::MAX_CSS_BYTES) {
            $fail('Custom CSS is limited to '.(self::MAX_CSS_BYTES / 1000).' KB.');
        }

        if (preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', $css)) {
            $fail('Custom CSS contains control characters.');
        }

        // Comments out first so nothing can hide inside one (u/**/rl( ...).
        $clean = preg_replace('#/\*.*?\*/#s', '', $css);

        if ($clean === null || str_contains($clean, '/*')) {
            $fail('Custom CSS has a comment that is never closed.');
        }

        if (str_contains($clean, '\\')) {
            $fail('Backslashes are not allowed in custom CSS (they can be used to hide what a rule does).');
        }

        if (preg_match('/[<]/', $clean)) {
            $fail('Custom CSS cannot contain "<". It is styles only, not markup.');
        }

        $lower = strtolower($clean);

        foreach (['url(' => 'url() (images and files must be uploaded in Settings, not linked)', 'image-set(' => 'image-set()', 'expression(' => 'expression()', 'javascript:' => 'javascript:', 'vbscript:' => 'vbscript:', 'behavior' => 'behavior', '-moz-binding' => '-moz-binding', 'src(' => 'src()'] as $needle => $label) {
            if (str_contains($lower, $needle)) {
                $fail("Custom CSS cannot use {$label}.");
            }
        }

        preg_match_all('/@([a-z-]+)/i', $clean, $atRules);

        foreach ($atRules[1] as $rule) {
            if (! in_array(strtolower($rule), ['media', 'supports', 'keyframes', '-webkit-keyframes'], true)) {
                $fail("Custom CSS cannot use @{$rule}. Allowed: @media, @supports, @keyframes.");
            }
        }

        if (substr_count($clean, '{') !== substr_count($clean, '}')) {
            $fail('Custom CSS has unbalanced braces { }.');
        }

        return trim($clean);
    }
}
