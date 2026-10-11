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
use App\Support\SeoAnalyzer;
use Illuminate\Console\Command;

class RescoreSeo extends Command
{
    protected $signature = 'seo:rescore';

    protected $description = 'Recompute the stored 0–100 on-page SEO score for every item that has SEO fields.';

    public function handle(): int
    {
        $store = Store::query()->orderBy('id')->firstOrFail();

        foreach ([Product::class, Page::class, Category::class, Brand::class, BlogPost::class, BlogCategory::class, BlogTag::class] as $class) {
            $count = 0;
            $with = $class === Product::class ? ['seoMetadata', 'images'] : ['seoMetadata'];

            $class::query()->where('store_id', $store->id)->whereHas('seoMetadata')->with($with)->chunkById(200, function ($chunk) use (&$count) {
                foreach ($chunk as $entity) {
                    SeoAnalyzer::persist($entity);
                    $count++;
                }
            });

            $this->info(class_basename($class).": {$count} rescored");
        }

        return self::SUCCESS;
    }
}
