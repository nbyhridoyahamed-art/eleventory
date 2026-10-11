<?php

namespace App\Console\Commands;

use App\Models\BlogCategory;
use App\Models\BlogPost;
use App\Models\BlogTag;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Page;
use App\Models\Product;
use App\Models\Store;
use App\Support\SeoGenerator;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;

class GenerateSeo extends Command
{
    protected $signature = 'seo:generate
        {entities=products,pages : Comma-separated: products,pages,categories,brands,blog_posts,blog_categories,blog_tags}
        {--overwrite : Replace existing SEO fields instead of only filling blank ones}';

    protected $description = 'Generate SEO titles, meta descriptions and focus keywords for catalog and content entities.';

    private const MAP = [
        'products' => Product::class,
        'pages' => Page::class,
        'categories' => Category::class,
        'brands' => Brand::class,
        'blog_posts' => BlogPost::class,
        'blog_categories' => BlogCategory::class,
        'blog_tags' => BlogTag::class,
    ];

    public function handle(): int
    {
        $store = Store::query()->orderBy('id')->firstOrFail();
        $generator = new SeoGenerator($store);
        $overwrite = (bool) $this->option('overwrite');

        foreach (array_map('trim', explode(',', $this->argument('entities'))) as $key) {
            /** @var class-string<Model>|null $class */
            $class = self::MAP[$key] ?? null;
            if (! $class) {
                $this->error("Unknown entity \"{$key}\".");

                return self::FAILURE;
            }

            $with = match ($class) {
                Product::class => ['category', 'brand', 'images', 'seoMetadata'],
                BlogPost::class => ['category', 'seoMetadata'],
                default => ['seoMetadata'],
            };

            $processed = 0;
            $updated = 0;

            $class::query()->where('store_id', $store->id)->with($with)->chunkById(200, function ($chunk) use ($generator, $overwrite, &$processed, &$updated) {
                foreach ($chunk as $entity) {
                    $processed++;
                    if ($generator->apply($entity, $generator->for($entity), $overwrite)) {
                        $updated++;
                    }
                }
            });

            $this->info("{$key}: {$updated} updated of {$processed}");
        }

        return self::SUCCESS;
    }
}
