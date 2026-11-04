<?php

namespace App\Policies;

use App\Models\Store;
use App\Models\User;

class StorePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('stores.view');
    }

    public function view(User $user, Store $store): bool
    {
        return $user->can('stores.view') && $this->reaches($user, $store);
    }

    public function create(User $user): bool
    {
        // With several tenants on the platform only platform staff open new stores here.
        return $user->can('stores.create') && (! config('app.saas_mode') || $user->hasRole('Platform Admin'));
    }

    public function update(User $user, Store $store): bool
    {
        return $user->can('stores.update') && $this->reaches($user, $store);
    }

    public function delete(User $user, Store $store): bool
    {
        return $user->can('stores.delete') && $this->reaches($user, $store);
    }

    /** In multi-tenant mode a store is only reachable by its members. */
    private function reaches(User $user, Store $store): bool
    {
        return ! config('app.saas_mode') || $user->canAccessStore($store->id);
    }
}
