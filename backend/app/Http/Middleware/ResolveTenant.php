<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\ApiResponse;
use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Decides which store a staff request acts for and proves the signed-in user
 * belongs to it. The client may name a store (X-Store-Id header or store_id
 * input) only to choose among stores they are a member of; naming anyone
 * else's store is rejected, and never widens access.
 *
 * Inactive unless SAAS_MODE is on, so single-store installs behave as before.
 */
class ResolveTenant
{
    public function __construct(private readonly TenantContext $tenant) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! config('app.saas_mode') || ! $user instanceof User) {
            return $next($request);
        }

        $requested = (int) ($request->header('X-Store-Id') ?: $request->input('store_id') ?: $user->current_store_id);

        if ($requested <= 0 || ! $user->canAccessStore($requested)) {
            return ApiResponse::error('You do not have access to this store.', [], 403);
        }

        $this->tenant->set($requested);

        try {
            return $next($request);
        } finally {
            $this->tenant->forget();
        }
    }
}
