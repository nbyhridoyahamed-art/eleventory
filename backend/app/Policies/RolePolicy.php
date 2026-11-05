<?php

namespace App\Policies;

use App\Models\User;
use Spatie\Permission\Models\Role;

class RolePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('roles.view');
    }

    public function view(User $user, Role $role): bool
    {
        return $user->can('roles.view');
    }

    public function create(User $user): bool
    {
        return $user->can('roles.create') && $this->platformOnlyInSaas($user);
    }

    public function update(User $user, Role $role): bool
    {
        return $user->can('roles.update') && $this->platformOnlyInSaas($user);
    }

    public function delete(User $user, Role $role): bool
    {
        return $user->can('roles.delete') && $this->platformOnlyInSaas($user);
    }

    /**
     * Roles are shared by every store, so in multi-tenant mode only the platform
     * operator may change what a role means; store staff just assign them.
     */
    private function platformOnlyInSaas(User $user): bool
    {
        return ! config('app.saas_mode') || $user->hasRole('Platform Admin');
    }
}
