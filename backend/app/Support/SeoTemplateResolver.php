<?php

namespace App\Support;

use App\Models\SeoTemplate;
use App\Models\Store;
use Illuminate\Database\Eloquent\Model;

/**
 * Builds the `seo` object the storefront receives for an entity, layering the
 * store's SEO template for that entity type under anything written by hand.
 * An item with no SEO of its own therefore still gets a proper title and
 * description from the template instead of falling back to its bare name.
 *
 * Placeholders: {name} {store} {category} {brand} {price}.
 */
final class SeoTemplateResolver
{
    /** @var array<string, SeoTemplate|null> keyed "storeId|entityClass" */
    private static array $templates = [];

    /** @var array<int, string> */
    private static array $storeNames = [];

    /** @return array<string, mixed>|null */
    public static function payload(Model $entity): ?array
    {
        $seo = $entity->relationLoaded('seoMetadata') ? $entity->seoMetadata : $entity->seoMetadata()->first();

        $payload = $seo ? [
            'title' => $seo->title,
            'description' => $seo->description,
            'focus_keyword' => $seo->focus_keyword,
            'canonical_url' => $seo->canonical_url,
            'robots' => $seo->robots,
            'og_title' => $seo->og_title,
            'og_description' => $seo->og_description,
            'og_image' => $seo->og_image,
            'twitter_title' => $seo->twitter_title,
            'twitter_description' => $seo->twitter_description,
            'twitter_image' => $seo->twitter_image,
            'schema_json' => $seo->schema_json,
        ] : null;

        $template = self::template($entity);
        if (! $template) {
            return $payload;
        }

        $payload ??= array_fill_keys([
            'title', 'description', 'focus_keyword', 'canonical_url', 'robots', 'og_title', 'og_description',
            'og_image', 'twitter_title', 'twitter_description', 'twitter_image', 'schema_json',
        ], null);

        $vars = self::variables($entity);

        if (blank($payload['title']) && filled($template->title_template)) {
            $payload['title'] = self::fill($template->title_template, $vars);
        }
        if (blank($payload['description']) && filled($template->description_template)) {
            $payload['description'] = self::fill($template->description_template, $vars);
        }

        return $payload;
    }

    /** @param array<string, string> $vars */
    public static function fill(string $pattern, array $vars): string
    {
        $text = preg_replace_callback('/\{(\w+)\}/', fn ($m) => $vars[$m[1]] ?? '', $pattern);

        return trim(preg_replace('/\s+/', ' ', (string) $text));
    }

    /** @return array<string, string> */
    public static function variables(Model $entity): array
    {
        $price = isset($entity->price_amount) ? '৳'.number_format($entity->price_amount / 100, 0) : '';

        return [
            'name' => (string) ($entity->name ?? $entity->title ?? ''),
            'store' => self::storeName((int) $entity->store_id),
            'category' => (string) ($entity->relationLoaded('category') ? ($entity->category?->name ?? '') : ''),
            'brand' => (string) ($entity->relationLoaded('brand') ? ($entity->brand?->name ?? '') : ''),
            'price' => $price,
        ];
    }

    private static function template(Model $entity): ?SeoTemplate
    {
        $key = $entity->store_id.'|'.$entity::class;

        if (! array_key_exists($key, self::$templates)) {
            self::$templates[$key] = SeoTemplate::query()
                ->where('store_id', $entity->store_id)
                ->where('entity_type', $entity::class)
                ->first();
        }

        return self::$templates[$key];
    }

    private static function storeName(int $storeId): string
    {
        return self::$storeNames[$storeId] ??= (string) Store::query()->whereKey($storeId)->value('name');
    }
}
