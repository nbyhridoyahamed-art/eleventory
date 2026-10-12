<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Every admin route already runs through auth:sanctum, but Sanctum's
 * bearer-token auth resolves whatever model owns the token — now that
 * Customer also has HasApiTokens (Phase 17), a customer's token would
 * otherwise authenticate here too, just as a wrong-typed $request->user().
 * This makes the "staff only" boundary an explicit, tested check instead
 * of relying on a Policy's User type-hint mismatch to fail closed.
 */
class EnsureStaffUser
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user() instanceof User) {
            return ApiResponse::error('Unauthenticated.', [], 401);
        }

        // A token issued for read-only use (e.g. an AI assistant in view-only
        // mode) may look but never change anything.
        $token = $request->user()->currentAccessToken();

        if ($token && method_exists($token, 'can') && ! $token->can('write') && ! in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return ApiResponse::error('This connection is read-only.', [], 403);
        }

        return $next($request);
    }
}
