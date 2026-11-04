<?php

namespace App\Models\Scopes;

use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $storeId = app(TenantContext::class)->activeStoreId();

        if ($storeId !== null) {
            $builder->where($model->qualifyColumn('store_id'), $storeId);
        }
    }
}
