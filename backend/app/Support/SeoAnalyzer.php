<?php

namespace App\Support;

use App\Models\BlogCategory;
use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Page;
use App\Models\Product;
use App\Models\SeoMetadata;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * On-page SEO analysis in the style of Rank Math: a 0–100 score built from a
 * set of plain, verifiable tests grouped as Basic SEO, Title & Description,
 * Additional, Title Readability and Content Readability.
 *
 * Deterministic — every test is a length, substring or count check, and every
 * result carries a human-readable detail so the editor can say exactly why
 * something passed or failed. Tests that make no sense for an item type (for
 * example "keyword in subheadings" on a product) are left out of that item's
 * score rather than counted as failures.
 */
final class SeoAnalyzer
{
    public const GOOD = 81;

    public const OK = 51;

    private const POWER_WORDS = [
        'best', 'new', 'free', 'ultimate', 'guide', 'top', 'proven', 'easy', 'fast', 'official', 'genuine',
        'original', 'exclusive', 'premium', 'complete', 'essential', 'powerful', 'amazing', 'smart', 'save',
        'cheap', 'affordable', 'latest', 'trusted', 'authentic', 'warranty', 'discount', 'deal', 'sale', 'review',
    ];

    /**
     * @param  array{
     *     title?: ?string, description?: ?string, keyword?: ?string, slug?: ?string, content?: ?string,
     *     kind?: string, images?: array<int, ?string>, entity_type?: ?string, entity_id?: ?int, store_id?: ?int
     * }  $input
     * @return array{score: int, level: string, tests: array<int, array<string, mixed>>}
     */
    public static function analyze(array $input): array
    {
        $kind = $input['kind'] ?? 'page';
        $longForm = in_array($kind, ['page', 'post'], true);

        $title = trim((string) ($input['title'] ?? ''));
        $description = trim((string) ($input['description'] ?? ''));
        $slug = trim((string) ($input['slug'] ?? ''));
        $html = (string) ($input['content'] ?? '');
        $keywordList = array_values(array_filter(array_map('trim', explode(',', (string) ($input['keyword'] ?? '')))));
        $keyword = $keywordList[0] ?? '';
        $keywordLower = mb_strtolower($keyword);

        $text = self::plainText($html);
        $words = self::wordCount($text);
        $textLower = mb_strtolower($text);
        $titleLower = mb_strtolower($title);
        $descriptionLower = mb_strtolower($description);

        $occurrences = $keywordLower !== '' ? mb_substr_count($textLower, $keywordLower) : 0;
        $firstSlice = mb_strtolower(mb_substr($text, 0, max((int) ceil(mb_strlen($text) * 0.1), 120)));
        $density = $words > 0 ? round($occurrences * max(self::wordCount($keyword), 1) / $words * 100, 2) : 0.0;

        $headings = self::headings($html);
        $keywordInHeading = $keywordLower !== '' && collect($headings)->contains(fn ($h) => str_contains(mb_strtolower($h), $keywordLower));
        $links = self::links($html);
        $paragraphs = self::paragraphs($html, $text);
        $longestParagraph = $paragraphs === [] ? 0 : max(array_map([self::class, 'wordCount'], $paragraphs));

        $images = $input['images'] ?? [];
        $imagesWithAlt = collect($images)->filter(fn ($alt) => filled($alt))->count();
        $imageAltHasKeyword = $keywordLower !== '' && collect($images)->contains(fn ($alt) => filled($alt) && str_contains(mb_strtolower((string) $alt), $keywordLower));

        $minWords = $longForm ? 300 : 80;
        $keywordSlug = $keyword !== '' ? Str::slug($keyword) : '';

        $tests = [];
        $add = function (string $id, string $group, string $label, int $weight, bool $passed, string $detail, bool $applicable = true) use (&$tests) {
            if ($applicable) {
                $tests[] = compact('id', 'group', 'label', 'weight', 'passed', 'detail');
            }
        };

        // ---- Basic SEO
        $add('keyword_set', 'Basic SEO', 'Set a focus keyword', 10, $keyword !== '',
            $keyword !== '' ? "Focus keyword: “{$keyword}”." : 'Add the main phrase this page should rank for.');
        $add('keyword_in_title', 'Basic SEO', 'Focus keyword is in the SEO title', 10, $keyword !== '' && str_contains($titleLower, $keywordLower),
            $keyword === '' ? 'Set a focus keyword first.' : (str_contains($titleLower, $keywordLower) ? 'The keyword appears in the title.' : 'Add the keyword to the SEO title.'));
        $add('keyword_in_description', 'Basic SEO', 'Focus keyword is in the meta description', 8, $keyword !== '' && str_contains($descriptionLower, $keywordLower),
            $keyword === '' ? 'Set a focus keyword first.' : (str_contains($descriptionLower, $keywordLower) ? 'The keyword appears in the description.' : 'Add the keyword to the meta description.'));
        $add('keyword_in_url', 'Basic SEO', 'Focus keyword is in the URL', 8, $keywordSlug !== '' && str_contains($slug, $keywordSlug),
            $keywordSlug === '' ? 'Set a focus keyword first.' : ($slug !== '' && str_contains($slug, $keywordSlug) ? "The URL contains “{$keywordSlug}”." : 'Use the keyword in the URL slug.'));
        $add('keyword_in_intro', 'Basic SEO', 'Focus keyword appears near the start of the content', 6, $keyword !== '' && str_contains($firstSlice, $keywordLower),
            $keyword === '' ? 'Set a focus keyword first.' : (str_contains($firstSlice, $keywordLower) ? 'Found in the first 10% of the content.' : 'Mention the keyword in the first paragraph.'), $words > 0);
        $add('keyword_in_content', 'Basic SEO', 'Focus keyword is used in the content', 5, $occurrences > 0,
            $occurrences > 0 ? "Used {$occurrences} time".($occurrences === 1 ? '' : 's').'.' : 'The keyword is not in the content.', $words > 0);
        $add('content_length', 'Basic SEO', "Content is at least {$minWords} words", 8, $words >= $minWords,
            "The content has {$words} words".($words >= $minWords ? '.' : "; aim for {$minWords} or more."));
        $add('keyword_density', 'Basic SEO', 'Keyword density is natural (0.5–2.5%)', 4, $density >= 0.5 && $density <= 2.5,
            $keyword === '' ? 'Set a focus keyword first.' : "Keyword density is {$density}%.", $keyword !== '' && $words >= 30);

        // ---- Title & description
        $titleLength = mb_strlen($title);
        $descriptionLength = mb_strlen($description);
        $add('title_length', 'Title & Description', 'SEO title is 30–60 characters', 6, $titleLength >= 30 && $titleLength <= 60,
            "The title is {$titleLength} characters.");
        $add('description_length', 'Title & Description', 'Meta description is 120–160 characters', 6, $descriptionLength >= 120 && $descriptionLength <= 160,
            "The description is {$descriptionLength} characters.");
        $add('title_starts_with_keyword', 'Title & Description', 'SEO title starts with the focus keyword', 3,
            $keyword !== '' && str_starts_with($titleLower, $keywordLower),
            $keyword === '' ? 'Set a focus keyword first.' : (str_starts_with($titleLower, $keywordLower) ? 'The title opens with the keyword.' : 'Titles that start with the keyword tend to rank better.'));

        // ---- Additional
        $add('keyword_in_headings', 'Additional', 'Focus keyword is in a subheading', 4, $keywordInHeading,
            $headings === [] ? 'No subheadings (H2–H6) found.' : ($keywordInHeading ? 'Found in a subheading.' : 'Use the keyword in at least one subheading.'), $longForm && $keyword !== '');
        $add('image_alt', 'Additional', 'Images have alt text'.($keyword !== '' ? ' with the keyword' : ''), 4,
            $images !== [] && $imagesWithAlt === count($images) && ($keyword === '' || $imageAltHasKeyword),
            $images === [] ? 'No images.' : ($imagesWithAlt < count($images) ? (count($images) - $imagesWithAlt).' image(s) have no alt text.' : ($imageAltHasKeyword || $keyword === '' ? 'Every image has descriptive alt text.' : 'Add the keyword to an image’s alt text.')),
            $images !== []);
        $add('internal_links', 'Additional', 'Content has internal links', 4, $links['internal'] > 0,
            $links['internal'] > 0 ? "{$links['internal']} internal link(s)." : 'Link to other pages on your site.', $longForm);
        $add('external_links', 'Additional', 'Content links to a trusted external source', 3, $links['external'] > 0,
            $links['external'] > 0 ? "{$links['external']} external link(s)." : 'Add at least one external link to a relevant source.', $longForm);
        $add('keyword_unique', 'Additional', 'Focus keyword is not used on other pages', 5, $keyword !== '' && ! self::keywordUsedElsewhere($keywordLower, $input),
            $keyword === '' ? 'Set a focus keyword first.' : (self::keywordUsedElsewhere($keywordLower, $input) ? 'Another item already targets this keyword.' : 'No other item targets this keyword.'));
        $add('short_url', 'Additional', 'URL is short (under 75 characters)', 2, $slug !== '' && mb_strlen($slug) <= 75,
            $slug === '' ? 'No URL slug set.' : 'The URL is '.mb_strlen($slug).' characters.');

        // ---- Title readability
        $add('title_number', 'Title Readability', 'SEO title contains a number', 3, (bool) preg_match('/\d/', $title),
            preg_match('/\d/', $title) ? 'The title includes a number.' : 'Numbers (sizes, years, “5 ways”) make titles stand out.', $title !== '');
        $add('title_power_word', 'Title Readability', 'SEO title has a power word', 3,
            collect(self::POWER_WORDS)->contains(fn ($w) => (bool) preg_match('/\b'.preg_quote($w, '/').'\b/i', $title)),
            'Words like “best”, “new” or “genuine” lift click-through.', $title !== '');

        // ---- Content readability
        $add('paragraph_length', 'Content Readability', 'Paragraphs are short (under 120 words)', 3, $longestParagraph <= 120,
            $longestParagraph === 0 ? 'No paragraphs.' : "Longest paragraph: {$longestParagraph} words.", $paragraphs !== [] && $longForm);
        $add('has_subheadings', 'Content Readability', 'Long content is broken up with subheadings', 3, count($headings) >= 2,
            count($headings) >= 2 ? count($headings).' subheadings.' : 'Add subheadings (H2) to break up the text.', $longForm && $words > 300);

        $total = max(array_sum(array_column($tests, 'weight')), 1);
        $earned = array_sum(array_map(fn ($t) => $t['passed'] ? $t['weight'] : 0, $tests));
        $score = (int) round($earned / $total * 100);

        return [
            'score' => $score,
            'level' => $score >= self::GOOD ? 'good' : ($score >= self::OK ? 'ok' : 'poor'),
            'tests' => $tests,
        ];
    }

    /** Builds the analyzer input for a stored entity and its saved SEO fields. */
    public static function inputFor(Model $entity, ?SeoMetadata $seo = null): array
    {
        $seo ??= $entity->seoMetadata;

        $base = [
            'title' => $seo?->title,
            'description' => $seo?->description,
            'keyword' => $seo?->focus_keyword,
            'entity_type' => $entity::class,
            'entity_id' => $entity->getKey(),
            'store_id' => $entity->store_id,
            'slug' => $entity->slug ?? '',
        ];

        return match (true) {
            $entity instanceof Product => $base + [
                'kind' => 'product',
                'content' => (string) ($entity->description ?: $entity->short_description),
                // The storefront falls back to the product name for a blank alt.
                'images' => $entity->images->map(fn ($image) => $image->alt_text ?: $entity->name)->all(),
            ],
            $entity instanceof Page => $base + ['kind' => 'page', 'content' => (string) $entity->content],
            $entity instanceof BlogPost => $base + ['kind' => 'post', 'content' => (string) $entity->body],
            $entity instanceof Category => $base + ['kind' => 'category', 'content' => (string) $entity->description],
            $entity instanceof Brand => $base + ['kind' => 'brand', 'content' => (string) $entity->description],
            $entity instanceof BlogCategory, $entity instanceof BlogTag => $base + ['kind' => 'term', 'content' => (string) ($entity->description ?? '')],
            default => $base + ['kind' => 'page', 'content' => ''],
        };
    }

    /** Analyses a saved entity and stores the resulting score on its seo_metadata row. */
    public static function persist(Model $entity): ?int
    {
        $seo = $entity->seoMetadata()->first();
        if (! $seo) {
            return null;
        }

        $score = self::analyze(self::inputFor($entity->loadMissing('seoMetadata'), $seo))['score'];
        $seo->forceFill(['score' => $score])->saveQuietly();

        return $score;
    }

    // ---- parsing helpers --------------------------------------------------

    private static function plainText(string $html): string
    {
        $text = preg_replace('#</(p|div|h[1-6]|li|ul|ol|tr)>|<br\s*/?>#i', "\n", $html);
        $text = html_entity_decode(strip_tags((string) $text), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return trim(preg_replace('/[ \t]+/u', ' ', str_replace("\u{00A0}", ' ', $text)));
    }

    private static function wordCount(string $text): int
    {
        return preg_match_all('/[\p{L}\p{N}][\p{L}\p{N}\'’\-]*/u', $text);
    }

    /** @return array<int, string> */
    private static function headings(string $html): array
    {
        preg_match_all('#<h([2-6])[^>]*>(.*?)</h\1>#is', $html, $m);

        return array_map(fn ($h) => trim(strip_tags($h)), $m[2] ?? []);
    }

    /** @return array{internal: int, external: int} */
    private static function links(string $html): array
    {
        preg_match_all('#<a\s[^>]*href=["\']([^"\']+)["\']#i', $html, $m);
        $internal = 0;
        $external = 0;
        $site = parse_url((string) config('app.frontend_url', ''), PHP_URL_HOST);

        foreach ($m[1] ?? [] as $href) {
            if (str_starts_with($href, '#') || str_starts_with($href, 'mailto:') || str_starts_with($href, 'tel:')) {
                continue;
            }
            $host = parse_url($href, PHP_URL_HOST);
            if ($host === null || ($site && strcasecmp($host, $site) === 0)) {
                $internal++;
            } else {
                $external++;
            }
        }

        return compact('internal', 'external');
    }

    /** @return array<int, string> */
    private static function paragraphs(string $html, string $text): array
    {
        if (preg_match_all('#<p[^>]*>(.*?)</p>#is', $html, $m) && count($m[1]) > 0) {
            return array_values(array_filter(array_map(fn ($p) => trim(strip_tags($p)), $m[1])));
        }

        return array_values(array_filter(array_map('trim', preg_split('/\n{1,}/u', $text) ?: [])));
    }

    private static function keywordUsedElsewhere(string $keywordLower, array $input): bool
    {
        if ($keywordLower === '' || empty($input['store_id'])) {
            return false;
        }

        return SeoMetadata::query()
            ->where('store_id', $input['store_id'])
            // The primary keyword is the first of a comma-separated list (portable across MySQL and SQLite).
            ->where(fn ($q) => $q
                ->whereRaw('LOWER(TRIM(focus_keyword)) = ?', [$keywordLower])
                ->orWhereRaw('LOWER(focus_keyword) LIKE ?', [str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $keywordLower).',%']))
            ->when(! empty($input['entity_type']) && ! empty($input['entity_id']), fn ($q) => $q->where(
                fn ($w) => $w->where('entity_type', '!=', $input['entity_type'])->orWhere('entity_id', '!=', $input['entity_id']),
            ))
            ->exists();
    }
}
