<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seo\SeoSettingRequest;
use App\Models\BlogCategory;
use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\Brand;
use App\Models\Category;
use App\Models\HomepageBlock;
use App\Models\Page;
use App\Models\Product;
use App\Models\SeoMetadata;
use App\Models\SeoSetting;
use App\Models\Store;
use App\Support\ApiResponse;
use App\Support\SeoAnalyzer;
use App\Support\SeoGenerator;
use App\Support\SeoScorer;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The technical / site-wide half of the SEO section: robots.txt, sitemap,
 * schema, search-engine verification and analytics IDs, plus the homepage and
 * blog landing page meta — and the two tools that act on every entity at once
 * (an audit of what is missing, and a bulk SEO generator).
 */
class SeoSettingController extends Controller
{
    /** @var array<string, array{class: class-string<Model>, label: string}> */
    private const ENTITIES = [
        'products' => ['class' => Product::class, 'label' => 'Products'],
        'pages' => ['class' => Page::class, 'label' => 'Pages'],
        'categories' => ['class' => Category::class, 'label' => 'Categories'],
        'brands' => ['class' => Brand::class, 'label' => 'Brands'],
        'blog_posts' => ['class' => BlogPost::class, 'label' => 'Blog posts'],
        'blog_categories' => ['class' => BlogCategory::class, 'label' => 'Blog categories'],
        'blog_tags' => ['class' => BlogTag::class, 'label' => 'Blog tags'],
    ];

    public function show(Request $request): JsonResponse
    {
        $store = $this->store($request);

        return ApiResponse::success([
            'settings' => SeoSetting::resolved($store),
            'suggestions' => (new SeoGenerator($store))->forSite(),
        ], 'SEO settings fetched successfully.');
    }

    public function update(SeoSettingRequest $request): JsonResponse
    {
        $store = $this->store($request);

        $merged = $this->mergeSections(SeoSetting::resolved($store), $request->validated('settings'));

        SeoSetting::updateOrCreate(['store_id' => $store->id], ['data' => $merged]);

        return ApiResponse::success(['settings' => SeoSetting::resolved($store)], 'SEO settings updated successfully.');
    }

    /**
     * Coverage and quality of SEO per content type, a site-level checklist,
     * and the lowest-scoring items so you know where to start. Scores are the
     * stored 0–100 on-page scores (see SeoAnalyzer); an item with no SEO row
     * counts as 0.
     */
    public function audit(Request $request): JsonResponse
    {
        $store = $this->store($request);
        $settings = SeoSetting::resolved($store);

        $entities = [];
        $contentSum = 0;
        $attention = [];

        // Where each type is edited, for the "needs attention" links.
        $editPaths = [
            'products' => ['/dashboard/catalog/products/', 'name'],
            'pages' => ['/dashboard/content/pages/', 'title'],
            'categories' => ['/dashboard/catalog/categories/', 'name'],
            'brands' => ['/dashboard/catalog/brands/', 'name'],
            'blog_posts' => ['/dashboard/content/blog/posts/', 'title'],
        ];

        foreach (self::ENTITIES as $key => $meta) {
            $class = $meta['class'];
            $total = $class::query()->where('store_id', $store->id)->count();

            $rows = SeoMetadata::query()
                ->where('store_id', $store->id)
                ->where('entity_type', $class)
                ->whereIn('entity_id', $class::query()->where('store_id', $store->id)->select('id'))
                ->get(['entity_id', 'title', 'description', 'focus_keyword', 'score']);

            $scores = $rows->map(fn ($r) => $r->score ?? SeoScorer::passed($r->title, $r->description, $r->focus_keyword) * 20);
            $good = $scores->filter(fn ($s) => $s >= SeoAnalyzer::GOOD)->count();
            $ok = $scores->filter(fn ($s) => $s >= SeoAnalyzer::OK && $s < SeoAnalyzer::GOOD)->count();
            $poor = max($total - $good - $ok, 0); // includes items with no SEO row yet

            $averageScore = $total > 0 ? (int) round($scores->sum() / $total) : 0;
            $contentSum += $averageScore;

            $entities[] = [
                'key' => $key,
                'label' => $meta['label'],
                'total' => $total,
                'with_title' => $rows->filter(fn ($r) => filled($r->title))->count(),
                'with_description' => $rows->filter(fn ($r) => filled($r->description))->count(),
                'with_focus_keyword' => $rows->filter(fn ($r) => filled($r->focus_keyword))->count(),
                'good' => $good,
                'ok' => $ok,
                'poor' => $poor,
                'fully_optimized' => $good,
                'average_score' => $averageScore,
            ];

            if (isset($editPaths[$key]) && $total > 0) {
                [$path, $nameField] = $editPaths[$key];
                $scored = $rows->keyBy('entity_id');
                $candidates = $class::query()->where('store_id', $store->id)->select(['id', $nameField])
                    ->get()
                    ->map(fn ($item) => [
                        'id' => $item->id,
                        'name' => $item->{$nameField},
                        'score' => (int) ($scored[$item->id]->score ?? 0),
                        'has_seo' => $scored->has($item->id),
                    ])
                    ->sortBy('score')->take(4);

                foreach ($candidates as $candidate) {
                    $attention[] = [
                        'type' => $meta['label'],
                        'name' => $candidate['name'],
                        'score' => $candidate['score'],
                        'has_seo' => $candidate['has_seo'],
                        'edit' => $path.$candidate['id'],
                    ];
                }
            }
        }

        $checks = $this->siteChecks($store, $settings);
        $passedChecks = collect($checks)->where('passed', true)->count();
        $siteScore = (int) round($passedChecks / max(count($checks), 1) * 100);
        $contentScore = count($entities) > 0 ? (int) round($contentSum / count($entities)) : 0;

        return ApiResponse::success([
            'overall_score' => (int) round(($siteScore + $contentScore) / 2),
            'site_score' => $siteScore,
            'content_score' => $contentScore,
            'entities' => $entities,
            'checks' => $checks,
            'needs_attention' => collect($attention)->sortBy('score')->take(10)->values()->all(),
        ], 'SEO audit fetched successfully.');
    }
    /**
     * Fills in missing SEO titles / descriptions / focus keywords for the chosen
     * entity types. Never touches fields that already have a value unless
     * `overwrite` is true.
     */
    public function generate(Request $request): JsonResponse
    {
        $store = $this->store($request);

        $data = $request->validate([
            'entities' => ['required', 'array', 'min:1'],
            'entities.*' => ['string', 'in:'.implode(',', array_keys(self::ENTITIES))],
            'overwrite' => ['sometimes', 'boolean'],
        ]);

        $overwrite = (bool) ($data['overwrite'] ?? false);
        $generator = new SeoGenerator($store);

        set_time_limit(300);

        $results = [];
        foreach (array_unique($data['entities']) as $key) {
            $class = self::ENTITIES[$key]['class'];
            $processed = 0;
            $updated = 0;

            $with = match ($class) {
                Product::class => ['category', 'brand', 'images', 'seoMetadata'],
                BlogPost::class => ['category', 'seoMetadata'],
                default => ['seoMetadata'],
            };

            $class::query()->where('store_id', $store->id)->with($with)->chunkById(200, function ($chunk) use ($generator, $overwrite, &$processed, &$updated) {
                foreach ($chunk as $entity) {
                    $processed++;
                    if ($generator->apply($entity, $generator->for($entity), $overwrite)) {
                        $updated++;
                    }
                }
            });

            $results[] = ['key' => $key, 'label' => self::ENTITIES[$key]['label'], 'processed' => $processed, 'updated' => $updated];
        }

        return ApiResponse::success(['results' => $results], 'SEO generated successfully.');
    }

    /** @return array<int, array{id: string, group: string, label: string, passed: bool, hint: string, fix: string}> */
    private function siteChecks(Store $store, array $settings): array
    {
        $home = $settings['homepage'];
        $blog = $settings['blog'];
        $title = trim((string) $home['title']);
        $description = trim((string) $home['description']);

        $blocks = HomepageBlock::query()->where('store_id', $store->id)->where('is_active', true)->pluck('type');

        $check = fn (string $id, string $group, string $label, bool $passed, string $hint, string $fix) => compact('id', 'group', 'label', 'passed', 'hint', 'fix');

        return [
            $check('home-title', 'Homepage', 'Homepage SEO title is 30–60 characters', mb_strlen($title) >= 30 && mb_strlen($title) <= 60,
                'Write a title that says what the store sells and where, within 30–60 characters.', '/dashboard/seo/site'),
            $check('home-description', 'Homepage', 'Homepage meta description is 120–160 characters', mb_strlen($description) >= 120 && mb_strlen($description) <= 160,
                'Summarise the store in one or two sentences, 120–160 characters.', '/dashboard/seo/site'),
            $check('home-keyword', 'Homepage', 'Homepage has a focus keyword', filled($home['focus_keyword']),
                'Pick the phrase shoppers would search for to find the store.', '/dashboard/seo/site'),
            $check('home-og', 'Homepage', 'Homepage has a social sharing image', filled($home['og_image']) || filled($settings['site']['default_og_image']),
                'Add an image so links look good when shared on Facebook, WhatsApp and X.', '/dashboard/seo/site'),
            $check('home-hero', 'Homepage', 'Homepage has a hero banner', $blocks->contains(fn ($t) => in_array($t, ['hero', 'hero_slider'], true)),
                'A hero banner gives visitors and search engines a clear main message.', '/dashboard/content/homepage'),
            $check('home-products', 'Homepage', 'Homepage links to products or categories', $blocks->contains(fn ($t) => in_array($t, ['product_tabs', 'featured_products', 'latest_products', 'best_sellers', 'category_grid', 'category_carousel', 'product_carousel'], true)),
                'Product and category rows pass link strength to your catalog pages.', '/dashboard/content/homepage'),
            $check('home-blog', 'Homepage', 'Homepage links to the blog', $blocks->contains('blog_posts'),
                'Add a "From the Blog" section so the homepage links to the blog.', '/dashboard/content/homepage'),

            $check('blog-meta', 'Blog page', 'Blog page has its own title and description', filled($blog['title']) && filled($blog['description']),
                'Give the blog landing page its own SEO title and description.', '/dashboard/seo/site'),

            $check('site-og', 'Site', 'A default social sharing image is set', filled($settings['site']['default_og_image']),
                'Used whenever a page has no image of its own.', '/dashboard/seo/site'),
            $check('robots-open', 'Technical', 'Search engines are allowed to crawl the site', $settings['robots']['mode'] !== 'block_all',
                'Robots.txt is currently set to block the whole site.', '/dashboard/seo/technical'),
            $check('sitemap-on', 'Technical', 'XML sitemap is enabled', (bool) $settings['sitemap']['enabled'],
                'Sitemaps help search engines discover every product and page.', '/dashboard/seo/technical'),
            $check('schema-org', 'Technical', 'Organization structured data is on with a logo', (bool) $settings['schema']['organization'] && filled($settings['schema']['org_logo']),
                'Lets search engines show your logo and business details.', '/dashboard/seo/technical'),
            $check('schema-product', 'Technical', 'Product structured data is on', (bool) $settings['schema']['product'],
                'Enables price and availability rich results for products.', '/dashboard/seo/technical'),

            $check('verify-google', 'Integrations', 'Google Search Console is verified', filled($settings['verification']['google']),
                'Add the Google verification token to claim the site in Search Console.', '/dashboard/seo/integrations'),
            $check('verify-bing', 'Integrations', 'Bing Webmaster Tools is verified', filled($settings['verification']['bing']),
                'Add the Bing verification token to appear in Bing and Copilot.', '/dashboard/seo/integrations'),
            $check('analytics', 'Integrations', 'Analytics is connected (GA4 or Tag Manager)', filled($settings['analytics']['ga4_id']) || filled($settings['analytics']['gtm_id']),
                'Connect Google Analytics 4 or Google Tag Manager to measure traffic.', '/dashboard/seo/integrations'),
        ];
    }

    /**
     * Overlays the submitted sections on what is already stored, group by
     * group, so a request that only sends "robots" doesn't wipe the rest.
     *
     * @param  array<string, array<string, mixed>>  $current
     * @param  array<string, array<string, mixed>>  $incoming
     * @return array<string, array<string, mixed>>
     */
    private function mergeSections(array $current, array $incoming): array
    {
        foreach ($incoming as $group => $values) {
            if (! isset($current[$group]) || ! is_array($values)) {
                continue;
            }
            foreach ($values as $key => $value) {
                if (array_key_exists($key, $current[$group])) {
                    $current[$group][$key] = is_string($value) && trim($value) === '' ? (is_array($current[$group][$key]) ? [] : null) : $value;
                }
            }
        }

        return $current;
    }

    private function store(Request $request): Store
    {
        if (! $request->user()->can('seo.manage')) {
            throw new AuthorizationException;
        }

        return Store::query()->findOrFail($request->integer('store_id'));
    }
}
