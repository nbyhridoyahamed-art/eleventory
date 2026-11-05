<?php

namespace App\Http\Middleware;

use App\Models\Customer;
use App\Support\ApiResponse;
use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The customer-side mirror of EnsureStaffUser — rejects a staff token on
 * an account/* route the same explicit way, rather than letting it
 * through just because auth:sanctum found some valid token.
 */
class EnsureCustomerUser
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user() instanceof Customer) {
            return ApiResponse::error('Unauthenticated.', [], 401);
        }

        // A token minted for one store is dead anywhere else, even if the
        // customer row is later moved. Tokens issued before this claim existed
        // carry no store ability and keep working.
        foreach ($request->user()->currentAccessToken()?->abilities ?? [] as $ability) {
            if (is_string($ability) && str_starts_with($ability, 'store:') && (int) substr($ability, 6) !== (int) $request->user()->store_id) {
                return ApiResponse::error('Unauthenticated.', [], 401);
            }
        }

        app(TenantContext::class)->set((int) $request->user()->store_id);

        return $next($request);
    }
}
