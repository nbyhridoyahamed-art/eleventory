<?php

namespace App\Support;

use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * The homepage builder's block registry (spec section 85-90, 59, 60): every
 * block type's identifier, the validation rules for its `settings` JSON,
 * and its default settings for a freshly-added block. Adding a new block
 * type later means adding one case to each match() here — the controller,
 * request, and both resources are all type-agnostic.
 */
final class HomepageBlockTypes
{
    public const HERO = 'hero';

    public const HERO_SLIDER = 'hero_slider';

    public const ANNOUNCEMENT_BAR = 'announcement_bar';

    public const FEATURED_PRODUCTS = 'featured_products';

    public const LATEST_PRODUCTS = 'latest_products';

    public const BEST_SELLERS = 'best_sellers';

    public const CATEGORY_GRID = 'category_grid';

    public const CATEGORY_CAROUSEL = 'category_carousel';

    public const BRAND_CAROUSEL = 'brand_carousel';

    public const PRODUCT_CAROUSEL = 'product_carousel';

    public const PRODUCT_TABS = 'product_tabs';

    public const FLASH_SALE = 'flash_sale';

    public const COUNTDOWN = 'countdown';

    public const PROMO_BANNER = 'promo_banner';

    public const TWO_COLUMN_BANNER = 'two_column_banner';

    public const THREE_COLUMN_BANNER = 'three_column_banner';

    public const VIDEO = 'video';

    public const IMAGE_TEXT = 'image_text';

    public const RICH_TEXT = 'rich_text';

    public const TESTIMONIALS = 'testimonials';

    public const REVIEWS = 'reviews';

    public const FAQ = 'faq';

    public const NEWSLETTER = 'newsletter';

    public const GALLERY = 'gallery';

    public const TRUST_BADGES = 'trust_badges';

    public const STATISTICS = 'statistics';

    public const CTA = 'cta';

    public const BLOG_POSTS = 'blog_posts';

    public const CUSTOM_HTML = 'custom_html';

    public const CUSTOM_CSS = 'custom_css';

    public const SPACER = 'spacer';

    /** @var array<int, string> */
    public const ALL = [
        self::HERO, self::HERO_SLIDER, self::ANNOUNCEMENT_BAR,
        self::FEATURED_PRODUCTS, self::LATEST_PRODUCTS, self::BEST_SELLERS,
        self::CATEGORY_GRID, self::CATEGORY_CAROUSEL, self::BRAND_CAROUSEL,
        self::PRODUCT_CAROUSEL, self::PRODUCT_TABS, self::FLASH_SALE, self::COUNTDOWN,
        self::PROMO_BANNER, self::TWO_COLUMN_BANNER, self::THREE_COLUMN_BANNER,
        self::VIDEO, self::IMAGE_TEXT, self::RICH_TEXT,
        self::TESTIMONIALS, self::REVIEWS, self::FAQ, self::NEWSLETTER,
        self::GALLERY, self::TRUST_BADGES, self::STATISTICS, self::CTA,
        self::BLOG_POSTS, self::CUSTOM_HTML, self::CUSTOM_CSS, self::SPACER,
    ];

    /** Block types that source real catalog/content data, and how. */
    private const AUTO_MANUAL_TYPES = [
        self::FEATURED_PRODUCTS => 'products',
        self::CATEGORY_GRID => 'categories',
        self::CATEGORY_CAROUSEL => 'categories',
        self::BRAND_CAROUSEL => 'brands',
        self::TESTIMONIALS => 'testimonials',
        self::REVIEWS => 'testimonials',
    ];

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function settingsRules(string $type, int $storeId): array
    {
        if (array_key_exists($type, self::AUTO_MANUAL_TYPES)) {
            $table = self::AUTO_MANUAL_TYPES[$type];
            $idsField = Str::singular($table).'_ids'; // categories->category_ids, brands->brand_ids, products->product_ids, testimonials->testimonial_ids

            return [
                'settings.heading' => ['required', 'string', 'max:255'],
                'settings.limit' => ['required', 'integer', 'min:1', 'max:24'],
                'settings.mode' => ['required', Rule::in(['auto', 'manual'])],
                "settings.{$idsField}" => ['required_if:settings.mode,manual', 'array'],
                "settings.{$idsField}.*" => ['integer', Rule::exists($table, 'id')->where('store_id', $storeId)],
            ];
        }

        return match ($type) {
            self::HERO => [
                'settings.heading' => ['required', 'string', 'max:255'],
                'settings.subheading' => ['nullable', 'string', 'max:500'],
                'settings.image_url' => ['nullable', 'string', 'max:2048'],
                'settings.cta_label' => ['nullable', 'string', 'max:60'],
                'settings.cta_url' => ['nullable', 'string', 'max:2048'],
                'settings.secondary_cta_label' => ['nullable', 'string', 'max:60'],
                'settings.secondary_cta_url' => ['nullable', 'string', 'max:2048'],
            ],
            self::HERO_SLIDER => [
                'settings.slides' => ['required', 'array', 'min:1', 'max:8'],
                'settings.slides.*.heading' => ['required', 'string', 'max:255'],
                'settings.slides.*.subheading' => ['nullable', 'string', 'max:500'],
                'settings.slides.*.image_url' => ['nullable', 'string', 'max:2048'],
                'settings.slides.*.cta_label' => ['nullable', 'string', 'max:60'],
                'settings.slides.*.cta_url' => ['nullable', 'string', 'max:2048'],
                'settings.autoplay' => ['nullable', 'boolean'],
                'settings.interval_seconds' => ['nullable', 'integer', 'min:2', 'max:15'],
                // Optional promo tiles shown beside the slider (at most two, stacked).
                'settings.side_banners' => ['nullable', 'array', 'max:2'],
                'settings.side_banners.*.image_url' => ['nullable', 'string', 'max:2048'],
                'settings.side_banners.*.link_url' => ['nullable', 'string', 'max:2048'],
                'settings.side_banners.*.alt_text' => ['nullable', 'string', 'max:255'],
            ],
            self::ANNOUNCEMENT_BAR => [
                'settings.text' => ['required', 'string', 'max:255'],
                'settings.link_url' => ['nullable', 'string', 'max:2048'],
                'settings.link_label' => ['nullable', 'string', 'max:60'],
                'settings.dismissible' => ['nullable', 'boolean'],
            ],
            self::LATEST_PRODUCTS, self::BEST_SELLERS => [
                'settings.heading' => ['required', 'string', 'max:255'],
                'settings.limit' => ['required', 'integer', 'min:1', 'max:24'],
            ],
            self::PRODUCT_CAROUSEL => [
                'settings.heading' => ['required', 'string', 'max:255'],
                'settings.limit' => ['required', 'integer', 'min:1', 'max:24'],
                'settings.mode' => ['required', Rule::in(['auto', 'manual', 'category'])],
                'settings.product_ids' => ['required_if:settings.mode,manual', 'array'],
                'settings.product_ids.*' => ['integer', Rule::exists('products', 'id')->where('store_id', $storeId)],
                'settings.category_id' => ['required_if:settings.mode,category', 'nullable', 'integer', Rule::exists('categories', 'id')->where('store_id', $storeId)],
            ],
            self::PRODUCT_TABS => [
                'settings.heading' => ['required', 'string', 'max:255'],
                'settings.view_all_url' => ['nullable', 'string', 'max:2048'],
                'settings.limit' => ['required', 'integer', 'min:1', 'max:24'],
                'settings.tabs' => ['required', 'array', 'min:1', 'max:10'],
                'settings.tabs.*.label' => ['required', 'string', 'max:60'],
                'settings.tabs.*.source' => ['required', Rule::in(['newest', 'sale', 'featured', 'category', 'brand'])],
                // Slugs, not ids: the storefront filters the public product list by slug.
                'settings.tabs.*.category_slug' => ['nullable', 'string', 'max:255'],
                'settings.tabs.*.brand_slug' => ['nullable', 'string', 'max:255'],
            ],
            self::FLASH_SALE => [
                'settings.heading' => ['required', 'string', 'max:255'],
                'settings.ends_at' => ['required', 'date'],
                // Not required and no min:1: a freshly-added flash sale has
                // no items yet — its defaultSettings() can't seed a real
                // product_id (there's no way to know one in advance), so an
                // empty list has to be a valid starting state.
                // FlashSaleBlock renders nothing until items are added.
                'settings.items' => ['array', 'max:12'],
                'settings.items.*.product_id' => ['required', 'integer', Rule::exists('products', 'id')->where('store_id', $storeId)],
                'settings.items.*.sale_price' => ['required', 'numeric', 'min:0'],
            ],
            self::COUNTDOWN => [
                'settings.heading' => ['required', 'string', 'max:255'],
                'settings.subheading' => ['nullable', 'string', 'max:500'],
                'settings.ends_at' => ['required', 'date'],
                'settings.cta_label' => ['nullable', 'string', 'max:60'],
                'settings.cta_url' => ['nullable', 'string', 'max:2048'],
            ],
            self::PROMO_BANNER => [
                // Nullable: PromoBannerBlock renders nothing until an image
                // is set, and a freshly-added block hasn't had one uploaded
                // yet.
                'settings.image_url' => ['nullable', 'string', 'max:2048'],
                'settings.link_url' => ['nullable', 'string', 'max:2048'],
                'settings.alt_text' => ['nullable', 'string', 'max:255'],
            ],
            self::TWO_COLUMN_BANNER => self::bannerColumnRules(2),
            self::THREE_COLUMN_BANNER => self::bannerColumnRules(3),
            self::VIDEO => [
                'settings.heading' => ['nullable', 'string', 'max:255'],
                // Nullable, not required: a freshly-added block has no video
                // yet, and VideoBlock renders nothing until one is set —
                // same "optional until configured" contract as every image
                // field below, not a hole in the schema.
                'settings.video_url' => ['nullable', 'string', 'max:2048'],
                'settings.poster_image_url' => ['nullable', 'string', 'max:2048'],
                'settings.autoplay' => ['nullable', 'boolean'],
            ],
            self::IMAGE_TEXT => [
                // Nullable: ImageTextBlock already renders fine with no
                // image, and a freshly-added block hasn't had one uploaded
                // yet. `body` stays required — defaultSettings() seeds real
                // starter text for it instead, since empty body would
                // render as a visibly blank paragraph.
                'settings.image_url' => ['nullable', 'string', 'max:2048'],
                'settings.heading' => ['required', 'string', 'max:255'],
                'settings.body' => ['required', 'string'],
                'settings.cta_label' => ['nullable', 'string', 'max:60'],
                'settings.cta_url' => ['nullable', 'string', 'max:2048'],
                'settings.image_position' => ['nullable', Rule::in(['left', 'right'])],
            ],
            self::RICH_TEXT => [
                'settings.heading' => ['nullable', 'string', 'max:255'],
                // Nullable: RichTextBlock renders nothing until the admin
                // types something into the TipTap editor — an empty canvas
                // to start from, not a validation hole.
                'settings.body' => ['nullable', 'string'],
            ],
            self::FAQ => [
                'settings.heading' => ['nullable', 'string', 'max:255'],
                'settings.items' => ['required', 'array', 'min:1', 'max:20'],
                'settings.items.*.question' => ['required', 'string', 'max:255'],
                'settings.items.*.answer' => ['required', 'string'],
            ],
            self::NEWSLETTER => [
                'settings.heading' => ['required', 'string', 'max:255'],
                'settings.subheading' => ['nullable', 'string', 'max:500'],
                'settings.cta_label' => ['required', 'string', 'max:60'],
            ],
            self::GALLERY => [
                'settings.heading' => ['nullable', 'string', 'max:255'],
                // Not required and no min:1: a freshly-added gallery starts
                // empty (GalleryBlock renders nothing until images are
                // added) rather than forcing a fake placeholder image.
                'settings.images' => ['array', 'max:24'],
                'settings.images.*.image_url' => ['required', 'string', 'max:2048'],
                'settings.images.*.alt_text' => ['nullable', 'string', 'max:255'],
            ],
            self::TRUST_BADGES => [
                'settings.heading' => ['nullable', 'string', 'max:255'],
                'settings.items' => ['required', 'array', 'min:1', 'max:8'],
                'settings.items.*.icon' => ['required', 'string', 'max:60'],
                'settings.items.*.label' => ['required', 'string', 'max:120'],
            ],
            self::STATISTICS => [
                'settings.heading' => ['nullable', 'string', 'max:255'],
                'settings.items' => ['required', 'array', 'min:1', 'max:8'],
                'settings.items.*.value' => ['required', 'string', 'max:40'],
                'settings.items.*.label' => ['required', 'string', 'max:120'],
            ],
            self::CTA => [
                'settings.heading' => ['required', 'string', 'max:255'],
                'settings.subheading' => ['nullable', 'string', 'max:500'],
                'settings.cta_label' => ['required', 'string', 'max:60'],
                'settings.cta_url' => ['required', 'string', 'max:2048'],
                'settings.background_image_url' => ['nullable', 'string', 'max:2048'],
            ],
            self::BLOG_POSTS => [
                'settings.heading' => ['required', 'string', 'max:255'],
                'settings.limit' => ['required', 'integer', 'min:1', 'max:12'],
            ],
            self::CUSTOM_HTML => [
                // Trusted-input surface: only staff holding builder.edit can
                // ever reach this field, the same trust boundary every other
                // admin-authored field in this app already has — see
                // DEVELOPMENT_ROADMAP.md's Phase 13 scope note. Nullable, not
                // required: CustomHtmlBlock renders nothing until the admin
                // pastes something in.
                'settings.html' => ['nullable', 'string', 'max:20000'],
            ],
            self::CUSTOM_CSS => [
                'settings.css' => ['nullable', 'string', 'max:20000'],
            ],
            self::SPACER => [
                'settings.height_px' => ['required', 'integer', 'min:8', 'max:400'],
            ],
            default => [],
        };
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private static function bannerColumnRules(int $count): array
    {
        return [
            'settings.banners' => ['required', 'array', 'size:'.$count],
            // Nullable: MultiColumnBannerBlock skips any banner with no
            // image, and defaultSettings() seeds $count empty banner slots
            // for the admin to fill in — the slot count is fixed above, not
            // each slot's image.
            'settings.banners.*.image_url' => ['nullable', 'string', 'max:2048'],
            'settings.banners.*.link_url' => ['nullable', 'string', 'max:2048'],
            'settings.banners.*.alt_text' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * Validation rules shared by every block type for the generic
     * design/responsive/visibility/animation columns (spec section 60/61) —
     * independent of `settings`, which is the only type-specific piece.
     *
     * @return array<string, array<int, mixed>>
     */
    public static function styleRules(): array
    {
        $breakpointRules = [];
        foreach (['desktop', 'tablet', 'mobile'] as $bp) {
            $breakpointRules["responsive.{$bp}.width"] = ['nullable', 'string', 'max:20'];
            $breakpointRules["responsive.{$bp}.height"] = ['nullable', 'string', 'max:20'];
            $breakpointRules["responsive.{$bp}.padding"] = ['nullable', 'string', 'max:40'];
            $breakpointRules["responsive.{$bp}.margin"] = ['nullable', 'string', 'max:40'];
            $breakpointRules["responsive.{$bp}.font_size"] = ['nullable', 'string', 'max:20'];
            $breakpointRules["responsive.{$bp}.columns"] = ['nullable', 'integer', 'min:1', 'max:12'];
            $breakpointRules["responsive.{$bp}.gap"] = ['nullable', 'string', 'max:20'];
            $breakpointRules["responsive.{$bp}.alignment"] = ['nullable', Rule::in(['left', 'center', 'right', 'stretch'])];
            $breakpointRules["responsive.{$bp}.display"] = ['nullable', Rule::in(['block', 'flex', 'grid', 'none'])];
            $breakpointRules["visibility.{$bp}"] = ['nullable', 'boolean'];
        }

        return [
            'styles' => ['nullable', 'array'],
            'styles.background_color' => ['nullable', 'string', 'max:30'],
            'styles.text_color' => ['nullable', 'string', 'max:30'],
            'styles.border_radius' => ['nullable', 'string', 'max:20'],
            'styles.box_shadow' => ['nullable', 'string', 'max:60'],
            'styles.custom_class' => ['nullable', 'string', 'max:100'],
            'responsive' => ['nullable', 'array'],
            'visibility' => ['nullable', 'array'],
            'animation' => ['nullable', Rule::in(['none', 'fade', 'slide', 'scale', 'reveal'])],
            'scheduled_at' => ['nullable', 'date'],
            ...$breakpointRules,
        ];
    }

    /**
     * Sensible starting settings for a freshly-added block of this type —
     * what the builder pre-fills before a staff member customizes it.
     *
     * @return array<string, mixed>
     */
    public static function defaultSettings(string $type): array
    {
        return match ($type) {
            self::HERO => ['heading' => 'Welcome to our store', 'subheading' => null, 'image_url' => null, 'cta_label' => 'Shop All Products', 'cta_url' => '/products', 'secondary_cta_label' => null, 'secondary_cta_url' => null],
            self::HERO_SLIDER => ['slides' => [['heading' => 'New Arrivals', 'subheading' => null, 'image_url' => null, 'cta_label' => 'Shop Now', 'cta_url' => '/products']], 'autoplay' => true, 'interval_seconds' => 5, 'side_banners' => []],
            self::ANNOUNCEMENT_BAR => ['text' => 'Free delivery on orders over ৳1,000', 'link_url' => null, 'link_label' => null, 'dismissible' => true],
            self::FEATURED_PRODUCTS => ['heading' => 'Featured Products', 'mode' => 'auto', 'limit' => 5, 'product_ids' => []],
            self::LATEST_PRODUCTS => ['heading' => 'Latest Arrivals', 'limit' => 8],
            self::BEST_SELLERS => ['heading' => 'Best Sellers', 'limit' => 8],
            self::CATEGORY_GRID => ['heading' => 'Shop by Category', 'mode' => 'auto', 'limit' => 6, 'category_ids' => []],
            self::CATEGORY_CAROUSEL => ['heading' => 'Browse Categories', 'mode' => 'auto', 'limit' => 8, 'category_ids' => []],
            self::BRAND_CAROUSEL => ['heading' => 'Shop by Brand', 'mode' => 'auto', 'limit' => 8, 'brand_ids' => []],
            self::PRODUCT_CAROUSEL => ['heading' => 'You Might Also Like', 'mode' => 'auto', 'limit' => 10, 'product_ids' => [], 'category_id' => null],
            self::PRODUCT_TABS => ['heading' => 'Featured Products', 'view_all_url' => '/products', 'limit' => 10, 'tabs' => [['label' => 'New Arrivals', 'source' => 'newest', 'category_slug' => null, 'brand_slug' => null], ['label' => 'On Sale', 'source' => 'sale', 'category_slug' => null, 'brand_slug' => null]]],
            self::FLASH_SALE => ['heading' => 'Flash Sale', 'ends_at' => now()->addDay()->toIso8601String(), 'items' => []],
            self::COUNTDOWN => ['heading' => 'Limited Time Offer', 'subheading' => null, 'ends_at' => now()->addDay()->toIso8601String(), 'cta_label' => null, 'cta_url' => null],
            self::PROMO_BANNER => ['image_url' => null, 'link_url' => '/products', 'alt_text' => null],
            self::TWO_COLUMN_BANNER => ['banners' => [['image_url' => null, 'link_url' => null, 'alt_text' => null], ['image_url' => null, 'link_url' => null, 'alt_text' => null]]],
            self::THREE_COLUMN_BANNER => ['banners' => array_fill(0, 3, ['image_url' => null, 'link_url' => null, 'alt_text' => null])],
            self::VIDEO => ['heading' => null, 'video_url' => null, 'poster_image_url' => null, 'autoplay' => false],
            self::IMAGE_TEXT => ['image_url' => null, 'heading' => 'About Us', 'body' => 'Tell your story here.', 'cta_label' => null, 'cta_url' => null, 'image_position' => 'left'],
            self::RICH_TEXT => ['heading' => null, 'body' => null],
            self::TESTIMONIALS => ['heading' => 'What Our Customers Say', 'mode' => 'auto', 'limit' => 3, 'testimonial_ids' => []],
            self::REVIEWS => ['heading' => 'Customer Reviews', 'mode' => 'auto', 'limit' => 3, 'testimonial_ids' => []],
            self::FAQ => ['heading' => 'Frequently Asked Questions', 'items' => [['question' => 'What is your return policy?', 'answer' => 'Contact us within 7 days of delivery for a full refund or exchange.']]],
            self::NEWSLETTER => ['heading' => 'Stay in the loop', 'subheading' => 'Subscribe for offers and updates.', 'cta_label' => 'Subscribe'],
            self::GALLERY => ['heading' => null, 'images' => []],
            self::TRUST_BADGES => ['heading' => null, 'items' => [['icon' => 'truck', 'label' => 'Cash on Delivery'], ['icon' => 'shield', 'label' => 'Easy Returns']]],
            self::STATISTICS => ['heading' => null, 'items' => [['value' => '10,000+', 'label' => 'Happy Customers']]],
            self::CTA => ['heading' => 'Ready to shop?', 'subheading' => null, 'cta_label' => 'Shop Now', 'cta_url' => '/products', 'background_image_url' => null],
            self::BLOG_POSTS => ['heading' => 'From the Blog', 'limit' => 3],
            self::CUSTOM_HTML => ['html' => null],
            self::CUSTOM_CSS => ['css' => null],
            self::SPACER => ['height_px' => 40],
            default => [],
        };
    }

    /**
     * Converts a client-submitted settings payload into the form actually
     * stored — currently only flash_sale's per-item sale_price, which the
     * client sends as a decimal (matching every other money field's
     * API-boundary convention; see ProductController::preparePayload()) and
     * this converts to the minor-unit integer the resolver later reads back
     * with Money::toDecimal(). A no-op for every other type.
     *
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>
     */
    public static function normalizeSettingsForStorage(string $type, array $settings): array
    {
        if ($type !== self::FLASH_SALE || ! isset($settings['items'])) {
            return $settings;
        }

        $settings['items'] = collect($settings['items'])
            ->map(fn ($item) => [...$item, 'sale_price' => Money::fromDecimal($item['sale_price'])->amountMinor])
            ->all();

        return $settings;
    }
}
