<?php

namespace App\Models\Concerns;

use App\Models\Scopes\TenantScope;
use App\Support\Tenancy\TenantContext;

/**
 * Marks a model as owned by one store (tenant). See TenantContext.
 */
trait BelongsToStore
{
    public static function bootBelongsToStore(): void
    {
        static::addGlobalScope(new TenantScope);

        // A record can only be created inside the store the request acts for,
        // whatever store_id the client sent.
        static::creating(function ($model) {
            $storeId = app(TenantContext::class)->activeStoreId();

            if ($storeId !== null) {
                $model->store_id = $storeId;
            }
        });
    }
}
