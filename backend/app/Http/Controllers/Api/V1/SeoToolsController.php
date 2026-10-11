<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BlogCategory;
use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\Brand;
use App\Models\Category;
use App\Models\NotFoundLog;
use App\Models\Page;
use App\Models\Product;
use App\Models\SeoSetting;
use App\Models\Store;
use App\Support\ApiResponse;
use App\Support\SeoAnalyzer;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * The SEO section's working tools: the live on-page analyzer used by the
 * editors, the bulk re-scorer, the 404 monitor and IndexNow submission.
 */
class SeoToolsController extends Controller
{
    /** @var array<string, class-string<Model>> */
    private const KINDS = [
        'product' => Product::class,
        'page' => Page::class,
        'post' => BlogPost::class,
        'category' => Category::class,
        'brand' => Brand::class,
        'blog_category' => BlogCategory::class,
        'blog_tag' => BlogTag::class,
    ];

    /** @var array<string, class-string<Model>> */
    private const ENTITIES = [
        'products' => Product::class,
        'pages' => Page::class,
        'categories' => Category::class,
        'brands' => Brand::class,
        'blog_posts' => BlogPost::class,
        'blog_categories' => BlogCategory::class,
        'blog_tags' => BlogTag::class,
    ];

    /** Analyses an unsaved draft, so the editor can score as you type. */
    public function analyze(Request $request): JsonResponse
    {
        $store = $this->store($request);

        $data = $request->validate([
            'kind' => ['required', 'in:'.implode(',', array_keys(self::KINDS))],
            'entity_id' => ['nullable', 'integer'],
            'title' => ['nullable', 'string', 'max:500'],
            'description' => ['nullable', 'string', 'max:1000'],
            'keyword' => ['nullable', 'string', 'max:500'],
            'slug' => ['nullable', 'string', 'max:255'],
            'content' => ['nullable', 'string', 'max:300000'],
            'images' => ['nullable', 'array', 'max:50'],
            'images.*' => ['nullable', 'string', 'max:500'],
        ]);

        $class = self::KINDS[$data['kind']];

        // 'kind' for the analyzer is the content type, not the entity class.
        $analyzerKind = match ($data['kind']) {
            'blog_category', 'blog_tag' => 'term',
            default => $data['kind'],
        };

        return ApiResponse::success(SeoAnalyzer::analyze([
            'title' => $data['title'] ?? '',
            'description' => $data['description'] ?? '',
            'keyword' => $data['keyword'] ?? '',
            'slug' => $data['slug'] ?? '',
            'content' => $data['content'] ?? '',
            'images' => $data['images'] ?? [],
            'kind' => $analyzerKind,
            'entity_type' => $class,
            'entity_id' => $data['entity_id'] ?? null,
            'store_id' => $store->id,
        ]), 'SEO analysed successfully.');
    }

    /** Recomputes the stored score for every item that already has SEO fields. */
    public function rescore(Request $request): JsonResponse
    {
        $store = $this->store($request);

        $data = $request->validate([
            'entities' => ['nullable', 'array'],
            'entities.*' => ['string', 'in:'.implode(',', array_keys(self::ENTITIES))],
        ]);

        set_time_limit(300);

        $results = [];
        foreach ($data['entities'] ?? array_keys(self::ENTITIES) as $key) {
            $class = self::ENTITIES[$key];
            $count = 0;

            $with = $class === Product::class ? ['seoMetadata', 'images'] : ['seoMetadata'];

            $class::query()->where('store_id', $store->id)->whereHas('seoMetadata')->with($with)
                ->chunkById(200, function ($chunk) use (&$count) {
                    foreach ($chunk as $entity) {
                        SeoAnalyzer::persist($entity);
                        $count++;
                    }
                });

            $results[] = ['key' => $key, 'rescored' => $count];
        }

        return ApiResponse::success(['results' => $results], 'SEO scores refreshed successfully.');
    }

    // ---- 404 monitor ------------------------------------------------------

    public function notFoundIndex(Request $request): JsonResponse
    {
        $store = $this->store($request);

        $logs = NotFoundLog::query()
            ->where('store_id', $store->id)
            ->when($request->filled('search'), fn ($q) => $q->where('path', 'like', '%'.$request->string('search').'%'))
            ->orderByDesc('hits')
            ->orderByDesc('last_seen_at')
            ->paginate(min((int) $request->integer('per_page', 25), 100));

        return ApiResponse::success($logs->getCollection()->map(fn (NotFoundLog $log) => [
            'id' => $log->id,
            'path' => $log->path,
            'hits' => $log->hits,
            'last_referrer' => $log->last_referrer,
            'first_seen_at' => $log->first_seen_at,
            'last_seen_at' => $log->last_seen_at,
        ])->all(), '404 log fetched successfully.', [
            'current_page' => $logs->currentPage(),
            'per_page' => $logs->perPage(),
            'total' => $logs->total(),
            'last_page' => $logs->lastPage(),
        ]);
    }

    public function notFoundDestroy(Request $request, NotFoundLog $log): JsonResponse
    {
        $store = $this->store($request);
        abort_unless($log->store_id === $store->id, 404);

        $log->delete();

        return ApiResponse::success(message: 'Log entry removed.');
    }

    public function notFoundClear(Request $request): JsonResponse
    {
        $store = $this->store($request);

        NotFoundLog::query()->where('store_id', $store->id)->delete();

        return ApiResponse::success(message: '404 log cleared.');
    }

    // ---- IndexNow ---------------------------------------------------------

    /** Creates (or replaces) the IndexNow key; the storefront serves it at /<key>.txt. */
    public function indexNowKey(Request $request): JsonResponse
    {
        $store = $this->store($request);

        $current = SeoSetting::resolved($store);
        $current['indexnow']['key'] = bin2hex(random_bytes(16));

        SeoSetting::updateOrCreate(['store_id' => $store->id], ['data' => $current]);

        return ApiResponse::success(['key' => $current['indexnow']['key']], 'IndexNow key generated successfully.');
    }

    /**
     * Tells IndexNow-enabled search engines (Bing, Yandex, Seznam, Naver...)
     * that URLs were added or changed so they crawl them now rather than
     * waiting. Pass `urls` for specific pages, or omit it to send every
     * public URL in the sitemap.
     */
    public function indexNowSubmit(Request $request): JsonResponse
    {
        $store = $this->store($request);
        $settings = SeoSetting::resolved($store);
        $key = $settings['indexnow']['key'] ?? null;

        if (blank($key)) {
            return ApiResponse::error('Generate an IndexNow key first.', [], 422);
        }

        $data = $request->validate([
            'urls' => ['nullable', 'array', 'max:10000'],
            'urls.*' => ['string', 'max:2048'],
        ]);

        $site = rtrim((string) config('app.frontend_url'), '/');
        $host = parse_url($site, PHP_URL_HOST);

        $urls = collect($data['urls'] ?? $this->publicUrls($store, $site, $settings))
            ->map(fn ($u) => str_starts_with($u, '/') ? $site.$u : $u)
            ->filter(fn ($u) => parse_url($u, PHP_URL_HOST) === $host)
            ->unique()->values()->take(10000);

        if ($urls->isEmpty()) {
            return ApiResponse::error('There are no URLs to submit.', [], 422);
        }

        try {
            $response = Http::timeout(20)->acceptJson()->post('https://api.indexnow.org/indexnow', [
                'host' => $host,
                'key' => $key,
                'keyLocation' => "{$site}/{$key}.txt",
                'urlList' => $urls->all(),
            ]);
        } catch (\Throwable $e) {
            return ApiResponse::error('Could not reach IndexNow: '.$e->getMessage(), [], 502);
        }

        // 200/202 = accepted. 403 = key file not found at keyLocation, 422 = URLs not on the host.
        $accepted = in_array($response->status(), [200, 202], true);

        return ApiResponse::success([
            'accepted' => $accepted,
            'status' => $response->status(),
            'submitted' => $urls->count(),
        ], $accepted ? 'URLs submitted to IndexNow.' : 'IndexNow did not accept the submission (HTTP '.$response->status().').');
    }

    /** @return array<int, string> */
    private function publicUrls(Store $store, string $site, array $settings): array
    {
        $sitemap = $settings['sitemap'];
        $urls = [$site.'/', $site.'/products'];

        if ($sitemap['blog']) {
            $urls[] = $site.'/blog';
        }
        if ($sitemap['products']) {
            Product::query()->where('store_id', $store->id)->where('status', 'active')->pluck('slug')
                ->each(function ($slug) use (&$urls, $site) {
                    $urls[] = "{$site}/products/{$slug}";
                });
        }
        if ($sitemap['categories']) {
            Category::query()->where('store_id', $store->id)->where('status', 'active')->pluck('slug')
                ->each(function ($slug) use (&$urls, $site) {
                    $urls[] = "{$site}/category/{$slug}";
                });
        }
        if ($sitemap['brands']) {
            Brand::query()->where('store_id', $store->id)->where('status', 'active')->pluck('slug')
                ->each(function ($slug) use (&$urls, $site) {
                    $urls[] = "{$site}/brand/{$slug}";
                });
        }
        if ($sitemap['pages']) {
            Page::query()->where('store_id', $store->id)->where('status', 'published')->pluck('slug')
                ->each(function ($slug) use (&$urls, $site) {
                    $urls[] = "{$site}/pages/{$slug}";
                });
        }
        if ($sitemap['blog']) {
            BlogPost::query()->where('store_id', $store->id)->where('status', 'published')->pluck('slug')
                ->each(function ($slug) use (&$urls, $site) {
                    $urls[] = "{$site}/blog/{$slug}";
                });
        }

        return $urls;
    }

    private function store(Request $request): Store
    {
        if (! $request->user()->can('seo.manage')) {
            throw new AuthorizationException;
        }

        return Store::query()->findOrFail($request->integer('store_id'));
    }
}
