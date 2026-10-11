<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Store;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Every SEO-bearing entity (Product, Category, Brand, Page, BlogPost,
 * BlogCategory, BlogTag, Store) accepts and returns its SEO overrides as a
 * nested `seo` object on its own existing endpoint rather than through a
 * separate seo-metadata resource — mirroring how BlogPost accepts tag_ids
 * and syncs its tags pivot as part of one save.
 */
trait SyncsSeoMetadata
{
    private function syncSeoMetadata(Model $entity, Request $request): void
    {
        if (! $request->filled('seo')) {
            return;
        }

        $entity->seoMetadata()->updateOrCreate([], [
            'store_id' => $entity instanceof Store ? $entity->id : $entity->store_id,
            ...$request->input('seo'),
        ]);

        // Keep the stored 0–100 on-page score current (the Store itself has no page content to score).
        if (! $entity instanceof Store) {
            \App\Support\SeoAnalyzer::persist($entity);
        }
    }
}
