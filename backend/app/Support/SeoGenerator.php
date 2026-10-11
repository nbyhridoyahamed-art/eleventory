<?php

namespace App\Support;

use App\Models\BlogCategory;
use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Page;
use App\Models\Product;
use App\Models\SeoTemplate;
use App\Models\Store;
use Illuminate\Database\Eloquent\Model;

/**
 * Builds an SEO title, meta description and focus keyword for catalog and
 * content entities from what the entity already says about itself.
 *
 * Deterministic and rule-based — no AI, nothing invented. Output is shaped to
 * the same five checks the editor's SEO checklist uses: title 30–60
 * characters, description 120–160, a focus keyword that appears in both.
 *
 * If the store has an SEO template for the entity type, its patterns win
 * ({name} {store} {category} {brand} {price}); otherwise built-in patterns
 * are used.
 */
final class SeoGenerator
{
    private const TITLE_MIN = 30;

    private const TITLE_MAX = 60;

    private const DESC_MIN = 120;

    private const DESC_MAX = 160;

    /** @var array<string, SeoTemplate> keyed by entity class */
    private array $templates;

    public function __construct(private readonly Store $store)
    {
        $this->templates = SeoTemplate::query()
            ->where('store_id', $store->id)
            ->get()
            ->keyBy('entity_type')
            ->all();
    }

    /** @return array{title: string, description: string, focus_keyword: string} */
    public function for(Model $entity): array
    {
        return match (true) {
            $entity instanceof Product => $this->product($entity),
            $entity instanceof Page => $this->page($entity),
            $entity instanceof Category => $this->category($entity),
            $entity instanceof Brand => $this->brand($entity),
            $entity instanceof BlogPost => $this->blogPost($entity),
            $entity instanceof BlogCategory => $this->blogTerm($entity, 'Blog'),
            $entity instanceof BlogTag => $this->blogTerm($entity, 'Blog'),
            default => throw new \InvalidArgumentException('Unsupported entity: '.$entity::class),
        };
    }

    /**
     * Saves the generated values on the entity's seo_metadata row. Without
     * $overwrite only blank fields are filled, so hand-written SEO is never
     * clobbered. Returns whether anything changed.
     *
     * @param  array{title: string, description: string, focus_keyword: string}  $generated
     */
    public function apply(Model $entity, array $generated, bool $overwrite = false): bool
    {
        $existing = $entity->seoMetadata;
        $data = [];

        foreach (['title', 'description', 'focus_keyword'] as $field) {
            if ($overwrite || blank($existing?->{$field})) {
                $data[$field] = $generated[$field];
            }
        }

        if ($data === []) {
            return false;
        }

        $entity->seoMetadata()->updateOrCreate([], ['store_id' => $entity->store_id, ...$data]);
        $entity->unsetRelation('seoMetadata');
        SeoAnalyzer::persist($entity);

        return true;
    }

    /**
     * Suggested homepage and blog landing page meta, built from the store name
     * and its best-stocked top-level categories. Offered in the SEO section as
     * a starting point; nothing is saved until the owner accepts it.
     *
     * @return array{homepage: array{title: string, description: string, focus_keyword: string}, blog: array{title: string, description: string, focus_keyword: string}}
     */
    public function forSite(): array
    {
        $store = $this->store->name;

        // Rank top-level categories by their own products plus their sub-categories'.
        $perCategory = Product::query()
            ->where('store_id', $this->store->id)->where('status', 'active')->whereNotNull('category_id')
            ->selectRaw('category_id, COUNT(*) as total')->groupBy('category_id')->pluck('total', 'category_id');

        $topCategories = Category::query()
            ->where('store_id', $this->store->id)->whereNull('parent_id')
            ->with('children:id,parent_id')
            ->get(['id', 'name', 'parent_id'])
            ->map(fn (Category $c) => [
                'name' => $c->name,
                'total' => (int) ($perCategory[$c->id] ?? 0) + $c->children->sum(fn ($child) => (int) ($perCategory[$child->id] ?? 0)),
            ])
            // Catch-all and promo buckets make poor keywords.
            ->reject(fn ($row) => in_array(mb_strtolower($row['name']), ['others', 'other', 'free delivery', 'finds for you', 'uncategorized'], true))
            ->sortByDesc('total')
            ->take(3)
            ->pluck('name')
            ->values()
            ->all();

        $list = match (count($topCategories)) {
            0 => 'the latest products',
            1 => $topCategories[0],
            2 => $topCategories[0].' and '.$topCategories[1],
            default => $topCategories[0].', '.$topCategories[1].' and '.$topCategories[2],
        };

        $homeKeyword = 'online shopping in bangladesh';
        $homeTitle = $this->composeTitle("{$store} - Online Shopping in Bangladesh", [' | Best Prices', ' | COD', '']);
        $homeDescription = $this->composeDescription([
            "Shop {$list} with online shopping in Bangladesh at {$store}.",
            'Genuine products, great prices and Cash on Delivery nationwide.',
            'Fast delivery and easy 7-day returns.',
            'Shop with confidence.',
        ]);

        $blogKeyword = mb_strtolower("{$store} blog");
        $blogTitle = $this->composeTitle("{$store} Blog", [' - Shopping Guides, Tips & News', ' - Guides & Tips', ' | Bangladesh']);
        $blogDescription = $this->composeDescription([
            "Read the {$store} blog for shopping guides, product tips and the latest news for customers in Bangladesh.",
            'New articles are added regularly.',
            'Helpful advice before you buy.',
        ]);

        return [
            'homepage' => ['title' => $homeTitle, 'description' => $homeDescription, 'focus_keyword' => $homeKeyword],
            'blog' => ['title' => $blogTitle, 'description' => $blogDescription, 'focus_keyword' => $blogKeyword],
        ];
    }

    // ---- per entity ------------------------------------------------------

    /** @return array{title: string, description: string, focus_keyword: string} */
    private function product(Product $product): array
    {
        $name = $this->plain($product->name);
        $price = '৳'.number_format($product->price_amount / 100, 0);
        $sale = $product->sale_price_amount !== null && $product->sale_price_amount < $product->price_amount
            ? '৳'.number_format($product->sale_price_amount / 100, 0)
            : null;
        $category = $product->category?->name;
        $brand = $product->brand?->name;

        $title = $this->composeTitle($name, [
            ' Price in Bangladesh | '.$this->store->name,
            ' Price in BD | '.$this->store->name,
            ' | '.$this->store->name,
            ' - Buy Online | '.$this->store->name,
        ]);

        $descriptor = $this->descriptor($product->description ?? $product->short_description);
        if ($descriptor === null) {
            $descriptor = $category
                ? "Shop {$category}".($brand ? " from {$brand}" : '').' with warranty and genuine quality.'
                : null;
        }

        $description = $this->composeDescription([
            'Buy '.$this->truncate($name, 70).' online in Bangladesh for '.($sale ?? $price).'.',
            $descriptor,
            'Cash on Delivery and fast nationwide delivery from '.$this->store->name.'.',
            'Genuine products with easy 7-day returns.',
            'Shop online with confidence.',
        ]);

        $keyword = $this->keyword($name, $title, $description);

        return $this->templated(Product::class, [
            'name' => $name, 'store' => $this->store->name, 'category' => $category ?? '', 'brand' => $brand ?? '', 'price' => $price,
        ], compact('title', 'description') + ['focus_keyword' => $keyword]);
    }

    /** @return array{title: string, description: string, focus_keyword: string} */
    private function page(Page $page): array
    {
        $name = $this->plain($page->title);
        $store = $this->store->name;

        $title = $this->composeTitle($name, [
            " | {$store}",
            " | {$store} Bangladesh",
            " | {$store} Online Shopping in Bangladesh",
        ]);

        $body = $this->plain($page->content, keepLines: true);
        // Prefer whole sentences: two if they fit, else one, else a trimmed first sentence.
        $lead = $this->sentences($body, 2);
        if ($lead !== '' && mb_strlen($name.': '.$lead) > 150) {
            $lead = $this->sentences($body, 1);
        }

        $first = $name.($lead !== '' ? ': '.$lead : '.');
        if (mb_strlen($first) > 150) {
            $first = rtrim($this->truncate($first, 148), ',;:-– ').'.';
        }

        $description = $this->composeDescription([
            $first,
            "Learn more at {$store}, your online store in Bangladesh with Cash on Delivery.",
            'Fast nationwide delivery and easy returns.',
            "Shop online at {$store}.",
            'Shop with confidence.',
        ]);

        $keyword = $this->keyword($name, $title, $description);

        return $this->templated(Page::class, ['name' => $name, 'store' => $store, 'category' => '', 'brand' => '', 'price' => ''],
            compact('title', 'description') + ['focus_keyword' => $keyword]);
    }

    /** @return array{title: string, description: string, focus_keyword: string} */
    private function category(Category $category): array
    {
        $name = $this->plain($category->name);
        $store = $this->store->name;
        $count = $category->products()->where('status', 'active')->count();

        $title = $this->composeTitle("{$name} Price in Bangladesh", [" | {$store}", " - Shop Online | {$store}"]);
        $description = $this->composeDescription([
            "Shop {$name} online in Bangladesh at {$store}.",
            $count > 0 ? "Browse {$count} products with great prices." : 'Browse the latest products and great prices.',
            'Cash on Delivery and fast nationwide delivery.',
            'Genuine products with easy 7-day returns.',
        ]);

        return $this->templated(Category::class, ['name' => $name, 'store' => $store, 'category' => $name, 'brand' => '', 'price' => ''],
            ['title' => $title, 'description' => $description, 'focus_keyword' => $this->keyword($name, $title, $description)]);
    }

    /** @return array{title: string, description: string, focus_keyword: string} */
    private function brand(Brand $brand): array
    {
        $name = $this->plain($brand->name);
        $store = $this->store->name;

        $title = $this->composeTitle("{$name} Products Price in Bangladesh", [" | {$store}", " - Official Range | {$store}"]);
        $description = $this->composeDescription([
            "Shop genuine {$name} products online in Bangladesh at {$store}.",
            'Best prices, warranty support and Cash on Delivery nationwide.',
            'Fast delivery and easy 7-day returns.',
        ]);

        return $this->templated(Brand::class, ['name' => $name, 'store' => $store, 'category' => '', 'brand' => $name, 'price' => ''],
            ['title' => $title, 'description' => $description, 'focus_keyword' => $this->keyword($name, $title, $description)]);
    }

    /** @return array{title: string, description: string, focus_keyword: string} */
    private function blogPost(BlogPost $post): array
    {
        $name = $this->plain($post->title);
        $store = $this->store->name;

        $title = $this->composeTitle($name, [" | {$store} Blog", " | {$store}", " - {$store} Blog Bangladesh"]);
        $excerpt = $this->plain($post->excerpt ?: $post->body);

        $description = $this->composeDescription([
            $this->sentences($excerpt, 2) ?: "{$name}.",
            "Read more on the {$store} blog: guides, tips and news for shoppers in Bangladesh.",
        ]);

        return $this->templated(BlogPost::class, ['name' => $name, 'store' => $store, 'category' => $post->category?->name ?? '', 'brand' => '', 'price' => ''],
            ['title' => $title, 'description' => $description, 'focus_keyword' => $this->keyword($name, $title, $description)]);
    }

    /** @return array{title: string, description: string, focus_keyword: string} */
    private function blogTerm(Model $term, string $kind): array
    {
        $name = $this->plain($term->name);
        $store = $this->store->name;

        $title = $this->composeTitle("{$name} Articles", [" | {$store} {$kind}", " - {$store} {$kind} Bangladesh"]);
        $description = $this->composeDescription([
            "Read {$name} articles, guides and tips on the {$store} {$kind}.",
            'News and shopping advice for customers in Bangladesh.',
            'Updated regularly with new posts.',
        ]);

        return $this->templated($term::class, ['name' => $name, 'store' => $store, 'category' => '', 'brand' => '', 'price' => ''],
            ['title' => $title, 'description' => $description, 'focus_keyword' => $this->keyword($name, $title, $description)]);
    }

    // ---- composition helpers --------------------------------------------

    /**
     * Applies the store's SEO template for this entity type (if any) over the
     * built-in result, filling each {placeholder} from $vars.
     *
     * @param  array<string, string>  $vars
     * @param  array{title: string, description: string, focus_keyword: string}  $generated
     * @return array{title: string, description: string, focus_keyword: string}
     */
    private function templated(string $entityClass, array $vars, array $generated): array
    {
        $template = $this->templates[$entityClass] ?? null;
        if (! $template) {
            return $generated;
        }

        $fill = function (?string $pattern) use ($vars): ?string {
            if (blank($pattern)) {
                return null;
            }
            $text = preg_replace_callback('/\{(\w+)\}/', fn ($m) => $vars[$m[1]] ?? '', $pattern);

            return trim(preg_replace('/\s+/', ' ', $text));
        };

        if ($title = $fill($template->title_template)) {
            $generated['title'] = $this->truncate($title, self::TITLE_MAX);
        }
        if ($description = $fill($template->description_template)) {
            $generated['description'] = $this->truncate($description, self::DESC_MAX);
        }

        return $generated;
    }

    /** Picks the first suffix that lands the title in 30–60 characters, shortening the subject only if it must. */
    private function composeTitle(string $subject, array $suffixes): string
    {
        foreach ($suffixes as $suffix) {
            $candidate = $subject.$suffix;
            $length = mb_strlen($candidate);
            if ($length >= self::TITLE_MIN && $length <= self::TITLE_MAX) {
                return $candidate;
            }
        }

        // Subject too long for every suffix: keep as much of it as fits next to the shortest one.
        $byLength = $suffixes;
        usort($byLength, fn ($a, $b) => mb_strlen($a) <=> mb_strlen($b));
        foreach ($byLength as $suffix) {
            $room = self::TITLE_MAX - mb_strlen($suffix);
            if ($room >= 12) {
                $candidate = $this->truncate($subject, $room).$suffix;
                if (mb_strlen($candidate) >= self::TITLE_MIN) {
                    return $candidate;
                }
            }
        }

        // Subject too short for every suffix: use the longest one.
        return $this->truncate($subject.end($suffixes), self::TITLE_MAX);
    }

    /** Joins as many parts as fit in 160 characters, then tops up to at least 120 from the remaining ones. */
    private function composeDescription(array $parts): string
    {
        $out = '';

        foreach (array_filter($parts, fn ($p) => filled($p)) as $part) {
            $candidate = trim($out.' '.$part);

            // Whole sentences only: a part that would overflow is skipped so a
            // shorter one after it can still be used, never cut mid-sentence.
            if (mb_strlen($candidate) <= self::DESC_MAX) {
                $out = $candidate;
            }
        }

        // Only if the very first part alone was too long (huge product name).
        if ($out === '') {
            $first = (string) (array_values(array_filter($parts, fn ($p) => filled($p)))[0] ?? '');
            $out = rtrim($this->truncate($first, self::DESC_MAX - 1), ',;:-– ').'.';
        }

        return $out;
    }

    /** Longest leading run of the name (up to 3 words) that appears in every given haystack. */
    private function keyword(string $name, string ...$haystacks): string
    {
        $words = preg_split('/\s+/u', trim(mb_strtolower($name)), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        for ($count = min(3, count($words)); $count >= 1; $count--) {
            $candidate = implode(' ', array_slice($words, 0, $count));
            $all = true;
            foreach ($haystacks as $haystack) {
                if (! str_contains(mb_strtolower($haystack), $candidate)) {
                    $all = false;
                    break;
                }
            }
            if ($all) {
                return $candidate;
            }
        }

        return $words[0] ?? '';
    }

    /** A short, non-promotional sentence from a longer description, or null. */
    private function descriptor(?string $html): ?string
    {
        foreach ($this->splitSentences($this->plain($html, keepLines: true)) as $sentence) {
            $length = mb_strlen($sentence);
            if ($length >= 30 && $length <= 110
                && ! str_contains($sentence, ':')
                && ! preg_match('/price in|buy online|best price|free delivery|cash on delivery|\d\s?(mm|cm|kg|g|mah|w|v)\b/i', $sentence)) {
                return rtrim($sentence, '.!?').'.';
            }
        }

        return null;
    }

    private function sentences(string $text, int $max): string
    {
        return trim(implode(' ', array_slice($this->splitSentences($text), 0, $max)));
    }

    /** @return array<int, string> */
    private function splitSentences(string $text): array
    {
        $parts = preg_split('/(?<=[.!?])\s+|\n+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        // Drop bullet glyphs and anything too short to be a sentence (headings, labels).
        $parts = array_map(fn ($p) => trim(preg_replace('/^[\s•·▪◦\-*–—]+/u', '', $p)), $parts);

        return array_values(array_filter($parts, fn ($s) => mb_strlen($s) >= 30));
    }

    private function plain(?string $text, bool $keepLines = false): string
    {
        $text = (string) $text;
        if ($keepLines) {
            $text = preg_replace('#</(p|div|h[1-6]|li|ul|ol)>|<br\s*/?>#i', "\n", $text);
        }
        $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = str_replace("\u{00A0}", ' ', $text);

        if ($keepLines) {
            $text = preg_replace('/[ \t]+/u', ' ', $text);

            return trim(preg_replace('/\s*\n\s*/u', "\n", $text));
        }

        return trim(preg_replace('/\s+/u', ' ', $text));
    }

    /** Cuts at a word boundary within $max characters, trimming trailing punctuation. */
    private function truncate(string $text, int $max): string
    {
        if (mb_strlen($text) <= $max) {
            return $text;
        }

        $cut = mb_substr($text, 0, $max);
        $space = mb_strrpos($cut, ' ');
        if ($space !== false && $space > $max * 0.5) {
            $cut = mb_substr($cut, 0, $space);
        }

        return rtrim($cut, " ,;:-–|&/(");
    }
}
