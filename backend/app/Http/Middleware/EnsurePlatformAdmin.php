<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The platform area is for the people who run Eleventory itself. Store owners, however
 * privileged inside their own shop, get 403; so does everything when SaaS mode is off.
 */
class EnsurePlatformAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! config('app.saas_mode') || ! $user instanceof User || ! $user->hasRole('Platform Admin')) {
            return ApiResponse::error('This area is for platform administrators.', [], 403);
        }

        return $next($request);
    }
}
