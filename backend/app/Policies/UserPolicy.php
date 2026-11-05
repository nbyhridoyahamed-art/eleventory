<?php

namespace App\Policies;

use App\Models\User;
use App\Support\Tenancy\TenantContext;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('users.view');
    }

    public function view(User $user, User $target): bool
    {
        return ($user->can('users.view') && $this->sharesStore($user, $target)) || $user->id === $target->id;
    }

    public function create(User $user): bool
    {
        return $user->can('users.create');
    }

    public function update(User $user, User $target): bool
    {
        return ($user->can('users.update') && $this->sharesStore($user, $target)) || $user->id === $target->id;
    }

    public function delete(User $user, User $target): bool
    {
        return $user->can('users.delete') && $user->id !== $target->id && $this->sharesStore($user, $target);
    }

    /** In multi-tenant mode staff only manage people who belong to a store they act for. */
    private function sharesStore(User $actor, User $target): bool
    {
        if (! config('app.saas_mode') || $actor->hasRole('Platform Admin')) {
            return true;
        }

        $storeId = app(TenantContext::class)->storeId();

        return $storeId !== null && $target->stores()->where('stores.id', $storeId)->exists();
    }

    public function assignRole(User $user): bool
    {
        return $user->can('roles.assign');
    }

    /** Only the platform operator may hand out (or take away) the Platform Admin role in multi-tenant mode. */
    public function assignPlatformAdmin(User $user): bool
    {
        return ! config('app.saas_mode') || $user->hasRole('Platform Admin');
    }
}
