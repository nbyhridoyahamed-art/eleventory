<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\HomepageBlock;
use App\Models\Product;
use App\Models\Store;
use App\Support\HomepageBlockTypes;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Lays out the storefront homepage as a stack of editable blocks: hero
 * slider with side banners, service strip, featured categories, tabbed
 * product rows, a wide promo and info cards.
 *
 * REPLACES the store's existing homepage blocks, so only run it deliberately
 * (db:seed --class=StorefrontHomepageSeeder). It also writes the banner
 * artwork (self-contained SVGs with a real product photo embedded) to
 * storage/app/public/banners and gives each top-level category a picture
 * taken from one of its in-stock products.
 */
class StorefrontHomepageSeeder extends Seeder
{
    public function run(): void
    {
        $store = Store::query()->orderBy('id')->firstOrFail(); // the app serves a single store; don't depend on its (editable) slug

        $this->seedCategoryImages($store);
        $banners = $this->writeBanners($store);

        HomepageBlock::where('store_id', $store->id)->delete();

        $tabs = fn (string $label, string $source, ?string $category = null, ?string $brand = null) => [
            'label' => $label, 'source' => $source, 'category_slug' => $category, 'brand_slug' => $brand,
        ];

        $blocks = [
            [HomepageBlockTypes::HERO_SLIDER, [
                'slides' => [
                    ['heading' => 'Smart Watches & Wearables', 'subheading' => 'Stay connected in style with the latest smart watches from top brands.', 'image_url' => $banners['hero1'], 'cta_label' => 'Shop Smart Watches', 'cta_url' => '/category/smart-watches'],
                    ['heading' => 'Premium Audio, Great Prices', 'subheading' => 'Speakers, earbuds and headphones you will love listening to.', 'image_url' => $banners['hero2'], 'cta_label' => 'Shop Audio', 'cta_url' => '/category/audio-and-music'],
                    ['heading' => 'Power Up On The Go', 'subheading' => 'Fast-charging power banks and cables, delivered nationwide.', 'image_url' => $banners['hero3'], 'cta_label' => 'Shop Power Banks', 'cta_url' => '/category/power-banks'],
                ],
                'autoplay' => true,
                'interval_seconds' => 6,
                'side_banners' => [
                    ['image_url' => $banners['side1'], 'link_url' => '/products?sale=1', 'alt_text' => 'Hot deals on top picks'],
                    ['image_url' => $banners['side2'], 'link_url' => '/products?sort=newest', 'alt_text' => 'New arrivals'],
                ],
            ]],
            [HomepageBlockTypes::TRUST_BADGES, ['heading' => null, 'items' => [
                ['icon' => 'banknote', 'label' => 'Cash on Delivery'],
                ['icon' => 'truck', 'label' => 'Nationwide Delivery'],
                ['icon' => 'rotate-ccw', 'label' => 'Easy 7-Day Returns'],
                ['icon' => 'badge-check', 'label' => '100% Genuine Products'],
                ['icon' => 'tag', 'label' => 'Best Price Deals'],
                ['icon' => 'headset', 'label' => 'Friendly Support'],
            ]]],
            [HomepageBlockTypes::CATEGORY_GRID, ['heading' => 'Featured Categories', 'mode' => 'manual', 'limit' => 16, 'category_ids' => $this->topCategoryIds($store, 16)]],
            [HomepageBlockTypes::PRODUCT_TABS, ['heading' => 'Exclusive Deals', 'view_all_url' => '/products?sale=1', 'limit' => 10, 'tabs' => [
                $tabs('Hot Deals', 'sale'),
                $tabs('New Arrivals', 'newest'),
            ]]],
            [HomepageBlockTypes::PRODUCT_TABS, ['heading' => 'Audio & Music', 'view_all_url' => '/category/audio-and-music', 'limit' => 10, 'tabs' => [
                $tabs('All', 'category', 'audio-and-music'),
                $tabs('Bluetooth Speakers', 'category', 'bluetooth-speakers'),
                $tabs('TWS Earbuds', 'category', 'tws-earbuds'),
                $tabs('Bluetooth Earphones', 'category', 'bluetooth-earphones'),
                $tabs('Headphones', 'category', 'bluetooth-headphones'),
            ]]],
            [HomepageBlockTypes::PROMO_BANNER, ['image_url' => $banners['wide'], 'link_url' => '/products?sale=1', 'alt_text' => 'Gadgets you will love, delivered nationwide']],
            [HomepageBlockTypes::PRODUCT_TABS, ['heading' => 'Featured Products', 'view_all_url' => '/products', 'limit' => 10, 'tabs' => [
                $tabs('Best Deals', 'sale'),
                $tabs('New Arrivals', 'newest'),
            ]]],
            [HomepageBlockTypes::PRODUCT_TABS, ['heading' => 'Mobile Accessories', 'view_all_url' => '/category/mobile-accessories', 'limit' => 10, 'tabs' => [
                $tabs('All', 'category', 'mobile-accessories'),
                $tabs('Power Banks', 'category', 'power-banks'),
                $tabs('Charger & Cables', 'category', 'charger-and-cables'),
                $tabs('USB Hubs', 'category', 'usb-hubs'),
            ]]],
            [HomepageBlockTypes::PRODUCT_TABS, ['heading' => 'Smart Watches', 'view_all_url' => '/category/smart-watches', 'limit' => 10, 'tabs' => [
                $tabs('Smart Watches', 'category', 'smart-watches'),
                $tabs('Watches', 'category', 'watches'),
            ]]],
            [HomepageBlockTypes::PRODUCT_TABS, ['heading' => 'Computer Accessories', 'view_all_url' => '/category/computer-accessories', 'limit' => 10, 'tabs' => [
                $tabs('All', 'category', 'computer-accessories'),
                $tabs('Mouse', 'category', 'mouse'),
                $tabs('Keyboard', 'category', 'keyboard'),
                $tabs('WiFi Router', 'category', 'wifi-router'),
                $tabs('Pen Drive', 'category', 'pen-drive'),
            ]]],
            [HomepageBlockTypes::PRODUCT_TABS, ['heading' => 'Lifestyle & Home', 'view_all_url' => '/category/lifestyle', 'limit' => 10, 'tabs' => [
                $tabs('All', 'category', 'lifestyle'),
                $tabs('Fans', 'category', 'fan'),
                $tabs('Torch Light', 'category', 'torch-light'),
                $tabs('Home Accessories', 'category', 'home-accessories'),
            ]]],
            [HomepageBlockTypes::PRODUCT_TABS, ['heading' => 'Top Brand Products', 'view_all_url' => '/brands', 'limit' => 10, 'tabs' => [
                $tabs('Hoco', 'brand', null, 'hoco'),
                $tabs('Havit', 'brand', null, 'havit'),
                $tabs('Fantech', 'brand', null, 'fantech'),
                $tabs('Joyroom', 'brand', null, 'joyroom'),
                $tabs('GearUP', 'brand', null, 'gearup'),
                $tabs('Xiaomi', 'brand', null, 'xiaomi'),
            ]]],
            [HomepageBlockTypes::BLOG_POSTS, ['heading' => 'From the Blog', 'limit' => 3]],
            [HomepageBlockTypes::CUSTOM_HTML, ['html' => $this->infoCards()]],
        ];

        foreach ($blocks as $index => [$type, $settings]) {
            HomepageBlock::create([
                'store_id' => $store->id,
                'type' => $type,
                'settings' => $settings,
                'styles' => [],
                'responsive' => [],
                'visibility' => [],
                'animation' => null,
                'sort_order' => $index,
                'is_active' => true,
            ]);
        }

        Cache::forget(HomepageBlock::storefrontCacheKey($store->id));
        $this->command?->info('Homepage rebuilt with '.count($blocks).' blocks.');
    }

    /** In-stock product (with an image) from a category or any of its children. */
    private function pictureProduct(Store $store, string|array $categorySlugs): ?Product
    {
        $slugs = (array) $categorySlugs;
        $categoryIds = Category::where('store_id', $store->id)
            ->where(fn ($q) => $q->whereIn('slug', $slugs)->orWhereIn('parent_id', Category::whereIn('slug', $slugs)->pluck('id')))
            ->pluck('id');

        return Product::query()
            ->where('store_id', $store->id)
            ->where('status', 'active')
            ->whereIn('category_id', $categoryIds)
            ->whereHas('images')
            ->whereRaw('(select coalesce(sum(quantity - quantity_reserved), 0) from stock_levels where stock_levels.product_id = products.id) > 0')
            ->with('images')
            ->orderByDesc('id')
            ->first();
    }

    private function seedCategoryImages(Store $store): void
    {
        foreach (Category::where('store_id', $store->id)->whereNull('parent_id')->get() as $category) {
            $product = $this->pictureProduct($store, $category->slug);
            $path = $product?->images->firstWhere('is_primary', true)?->path ?? $product?->images->first()?->path;
            if ($path) {
                $category->update(['image_path' => $path]);
            }
        }
    }

    /** @return array<int, int> */
    private function topCategoryIds(Store $store, int $limit): array
    {
        $counts = Product::query()
            ->where('store_id', $store->id)->where('status', 'active')->whereNotNull('category_id')
            ->whereRaw('(select coalesce(sum(quantity - quantity_reserved), 0) from stock_levels where stock_levels.product_id = products.id) > 0')
            ->selectRaw('category_id, COUNT(*) as total')->groupBy('category_id')->pluck('total', 'category_id');

        $tops = Category::where('store_id', $store->id)->whereNull('parent_id')->with('children:id,parent_id')->get();

        return $tops
            ->map(fn (Category $c) => [
                'id' => $c->id,
                'total' => (int) ($counts[$c->id] ?? 0) + $c->children->sum(fn ($child) => (int) ($counts[$child->id] ?? 0)),
            ])
            ->filter(fn ($row) => $row['total'] > 0)
            ->sortByDesc('total')
            ->take($limit)
            ->pluck('id')
            ->values()
            ->all();
    }

    /**
     * A product photo with its (near-white) studio background cut out, as a
     * base64 PNG data URI, so it can sit straight on a banner. Picks the first
     * in-stock candidate whose photo has a clean white border; null if none.
     */
    private function cutoutPhoto(Store $store, string $categorySlug): ?string
    {
        $slugs = [$categorySlug];
        $categoryIds = Category::where('store_id', $store->id)
            ->where(fn ($q) => $q->whereIn('slug', $slugs)->orWhereIn('parent_id', Category::whereIn('slug', $slugs)->pluck('id')))
            ->pluck('id');

        $candidates = Product::query()
            ->where('store_id', $store->id)->where('status', 'active')
            ->whereIn('category_id', $categoryIds)->whereHas('images')
            ->whereRaw('(select coalesce(sum(quantity - quantity_reserved), 0) from stock_levels where stock_levels.product_id = products.id) > 0')
            ->with('images')->orderByDesc('id')->limit(25)->get();

        foreach ($candidates as $product) {
            $path = $product->images->firstWhere('is_primary', true)?->path ?? $product->images->first()?->path;
            if (! $path || ! Storage::disk('public')->exists($path)) {
                continue;
            }

            $png = $this->removeWhiteBackground(Storage::disk('public')->get($path));
            if ($png !== null) {
                return 'data:image/png;base64,'.base64_encode($png);
            }
        }

        return null;
    }

    /**
     * Flood-fills "near white" pixels connected to the image border to
     * transparent (so white *inside* the product is kept) and softens the
     * edge. Returns null when the border isn't clean enough to cut reliably.
     */
    private function removeWhiteBackground(string $binary): ?string
    {
        $src = @imagecreatefromstring($binary);
        if (! $src) {
            return null;
        }

        $maxSide = 520;
        $w = imagesx($src);
        $h = imagesy($src);
        $scale = min(1, $maxSide / max($w, $h));
        $img = $scale < 1 ? imagescale($src, (int) round($w * $scale), (int) round($h * $scale)) : $src;
        $w = imagesx($img);
        $h = imagesy($img);

        $isWhite = function (int $x, int $y) use ($img): bool {
            $rgb = imagecolorat($img, $x, $y);

            return (($rgb >> 16) & 0xFF) > 232 && (($rgb >> 8) & 0xFF) > 232 && ($rgb & 0xFF) > 232;
        };

        // Reject photos whose border isn't mostly white (lifestyle shots, coloured backdrops).
        $border = 0;
        $white = 0;
        for ($x = 0; $x < $w; $x++) {
            foreach ([0, $h - 1] as $y) {
                $border++;
                $white += $isWhite($x, $y) ? 1 : 0;
            }
        }
        for ($y = 0; $y < $h; $y++) {
            foreach ([0, $w - 1] as $x) {
                $border++;
                $white += $isWhite($x, $y) ? 1 : 0;
            }
        }
        if ($border === 0 || $white / $border < 0.92) {
            return null;
        }

        // Flood fill from every white border pixel.
        $bg = array_fill(0, $w * $h, false);
        $stack = [];
        $push = function (int $x, int $y) use (&$stack, &$bg, $w, $h, $isWhite) {
            if ($x < 0 || $y < 0 || $x >= $w || $y >= $h) {
                return;
            }
            $i = $y * $w + $x;
            if ($bg[$i] || ! $isWhite($x, $y)) {
                return;
            }
            $bg[$i] = true;
            $stack[] = $i;
        };
        for ($x = 0; $x < $w; $x++) {
            $push($x, 0);
            $push($x, $h - 1);
        }
        for ($y = 0; $y < $h; $y++) {
            $push(0, $y);
            $push($w - 1, $y);
        }
        while ($stack) {
            $i = array_pop($stack);
            $x = $i % $w;
            $y = intdiv($i, $w);
            $push($x + 1, $y);
            $push($x - 1, $y);
            $push($x, $y + 1);
            $push($x, $y - 1);
        }

        $out = imagecreatetruecolor($w, $h);
        imagealphablending($out, false);
        imagesavealpha($out, true);
        $clear = imagecolorallocatealpha($out, 0, 0, 0, 127);
        imagefill($out, 0, 0, $clear);

        $touchesBg = function (int $x, int $y) use ($bg, $w, $h): bool {
            foreach ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [$dx, $dy]) {
                $nx = $x + $dx;
                $ny = $y + $dy;
                if ($nx >= 0 && $ny >= 0 && $nx < $w && $ny < $h && $bg[$ny * $w + $nx]) {
                    return true;
                }
            }

            return false;
        };

        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                if ($bg[$y * $w + $x]) {
                    continue;
                }
                $rgb = imagecolorat($img, $x, $y);
                $r = ($rgb >> 16) & 0xFF;
                $g = ($rgb >> 8) & 0xFF;
                $b = $rgb & 0xFF;
                // Light pixels hugging the cut-out are the anti-aliased halo: make them half transparent.
                $alpha = ($touchesBg($x, $y) && ($r + $g + $b) / 3 > 190) ? 80 : 0;
                imagesetpixel($out, $x, $y, imagecolorallocatealpha($out, $r, $g, $b, $alpha));
            }
        }

        ob_start();
        imagepng($out, null, 7);
        $png = ob_get_clean();

        return $png === false || $png === '' ? null : $png;
    }

    /** @return array<string, string> banner key => public URL */
    private function writeBanners(Store $store): array
    {
        // The cut-out product sits on an accent disc; the disc is part of the artwork.
        $product = function (?string $href, int $cx, int $cy, int $size, string $disc, float $discOpacity = 1.0) {
            $svg = '<circle cx="'.$cx.'" cy="'.$cy.'" r="'.round($size * 0.58).'" fill="'.$disc.'" fill-opacity="'.$discOpacity.'"/>';
            if ($href) {
                $svg .= '<image href="'.$href.'" x="'.($cx - $size / 2).'" y="'.($cy - $size / 2).'" width="'.$size.'" height="'.$size.'" preserveAspectRatio="xMidYMid meet"/>';
            }

            return $svg;
        };

        $hero = function (string $from, string $to, ?string $href) use ($product) {
            return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'.$from.'"/><stop offset="1" stop-color="'.$to.'"/></linearGradient></defs>'
                .'<rect width="1000" height="400" fill="url(#g)"/>'
                .'<circle cx="930" cy="40" r="170" fill="#ffffff" fill-opacity="0.07"/><circle cx="520" cy="420" r="150" fill="#ffffff" fill-opacity="0.06"/>'
                .$product($href, 770, 200, 300, '#ffa800').'</svg>';
        };

        $side = function (string $title, string $sub, string $cta, ?string $href) use ($product) {
            return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 200" font-family="Inter, Arial, sans-serif"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffa800"/><stop offset="1" stop-color="#ffd26a"/></linearGradient></defs>'
                .'<rect width="500" height="200" fill="url(#g)"/><circle cx="470" cy="30" r="110" fill="#ffffff" fill-opacity="0.25"/>'
                .'<text x="28" y="78" font-size="26" font-weight="700" fill="#0f172a">'.htmlspecialchars($title).'</text>'
                .'<text x="28" y="108" font-size="14" fill="#0f172a" fill-opacity="0.8">'.htmlspecialchars($sub).'</text>'
                .'<rect x="28" y="130" width="124" height="34" rx="17" fill="#0b3f91"/>'
                .'<text x="90" y="152" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">'.htmlspecialchars($cta).'</text>'
                .$product($href, 395, 102, 150, '#ffffff', 0.45).'</svg>';
        };

        $wide = function (?string $href) use ($product) {
            return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 220" font-family="Inter, Arial, sans-serif"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0b3f91"/><stop offset="1" stop-color="#1d5fd1"/></linearGradient></defs>'
                .'<rect width="1400" height="220" fill="url(#g)"/><circle cx="1230" cy="40" r="160" fill="#ffffff" fill-opacity="0.07"/>'
                .'<text x="60" y="98" font-size="38" font-weight="800" fill="#ffffff">Gadgets You&#8217;ll Love, Delivered Nationwide</text>'
                .'<text x="60" y="140" font-size="20" fill="#c9d8f3">Cash on Delivery &#183; Easy 7-day returns &#183; 100% genuine products</text>'
                .'<rect x="60" y="164" width="150" height="40" rx="20" fill="#ffa800"/>'
                .'<text x="135" y="190" font-size="15" font-weight="700" fill="#0f172a" text-anchor="middle">SHOP DEALS</text>'
                .$product($href, 1245, 110, 170, '#ffa800').'</svg>';
        };

        $files = [
            'hero1' => $hero('#0b3f91', '#1d5fd1', $this->cutoutPhoto($store, 'smart-watches')),
            'hero2' => $hero('#0f172a', '#0b3f91', $this->cutoutPhoto($store, 'bluetooth-speakers')),
            'hero3' => $hero('#0b3f91', '#0e7490', $this->cutoutPhoto($store, 'power-banks')),
            'side1' => $side('Hot Deals', 'Save big on top picks', 'SHOP NOW', $this->cutoutPhoto($store, 'tws-earbuds')),
            'side2' => $side('New Arrivals', 'Fresh gadgets weekly', 'EXPLORE', $this->cutoutPhoto($store, 'mouse')),
            'wide' => $wide($this->cutoutPhoto($store, 'keyboard')),
        ];

        $urls = [];
        foreach ($files as $key => $svg) {
            $path = "banners/home-{$key}.svg";
            Storage::disk('public')->put($path, $svg);
            $urls[$key] = Storage::disk('public')->url($path);
        }

        return $urls;
    }
    private function infoCards(): string
    {
        $cards = [
            ['#fdf0e6', 'Bangladesh&#8217;s Trusted Gadget Store', 'Eleventory brings you genuine gadgets, accessories and everyday essentials from well-known brands, at fair prices and with dependable nationwide delivery. Browse audio, mobile accessories, smart watches, computer gear and home appliances in one place.'],
            ['#e8f1fd', 'Genuine Products &amp; Warranty', 'Every product is sourced from brands or authorised distributors, so you get the real thing with the warranty it deserves. Check each product page for warranty details and specifications before you order.'],
            ['#e9f7ee', 'Cash on Delivery &amp; Fast Shipping', 'Order from anywhere in Bangladesh and pay when your parcel arrives. Inside Dhaka orders typically arrive in 1 to 2 working days and outside Dhaka in 3 to 5, with easy returns within 7 days on eligible items.'],
            ['#f3ecfb', 'Accessories for Your Devices', 'From fast chargers and power banks to earbuds, speakers, keyboards and smart watches, find the accessories that make your everyday devices work harder. New arrivals land every week, so check back often.'],
        ];

        $html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">';
        foreach ($cards as [$bg, $title, $text]) {
            $html .= '<div style="background:'.$bg.';border-radius:12px;padding:24px;color:#0f172a">'
                .'<h3 style="margin:0 0 10px;font-size:18px;font-weight:700">'.$title.'</h3>'
                .'<p style="margin:0;font-size:14px;line-height:1.7;color:#334155">'.$text.'</p></div>';
        }

        return $html.'</div>';
    }
}
