<?php

use App\Http\Controllers\McpController;
use App\Http\Middleware\EnsureCustomerUser;
use App\Http\Middleware\EnsureStaffUser;
use App\Http\Middleware\SecurityHeaders;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            // Remote MCP endpoint (Claude "custom connector"). No session/CSRF
            // middleware: it is a token-authenticated JSON-RPC API, and the token
            // may be part of the URL because connector forms have no auth field.
            Route::post('mcp/{token}', McpController::class)->where('token', '[0-9]+(\||%7C)[A-Za-z0-9]+');
            Route::post('mcp', McpController::class);
            Route::match(['GET', 'PUT', 'PATCH', 'DELETE'], 'mcp/{token?}', [McpController::class, 'unsupported']);
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'staff' => EnsureStaffUser::class,
            'customer' => EnsureCustomerUser::class,
        ]);

        // Phase 21: a real global backstop (the named 'api' limiter is
        // defined in AppServiceProvider::boot()) — previously every route
        // outside the handful with an explicit throttle:N,1 had none at
        // all beyond whatever the deployment's reverse proxy/WAF applied.
        $middleware->throttleApi();

        $middleware->append(SecurityHeaders::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $isApi = fn (Request $request) => $request->is('api/*') || $request->expectsJson();

        $exceptions->shouldRenderJsonWhen($isApi);

        $exceptions->render(function (ValidationException $e, Request $request) use ($isApi) {
            if (! $isApi($request)) {
                return null;
            }

            return ApiResponse::error('The given data was invalid.', $e->errors(), 422);
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) use ($isApi) {
            if (! $isApi($request)) {
                return null;
            }

            return ApiResponse::error('Unauthenticated.', [], 401);
        });

        $exceptions->render(function (AuthorizationException|AccessDeniedHttpException $e, Request $request) use ($isApi) {
            if (! $isApi($request)) {
                return null;
            }

            return ApiResponse::error('You do not have permission to perform this action.', [], 403);
        });

        $exceptions->render(function (ModelNotFoundException|NotFoundHttpException $e, Request $request) use ($isApi) {
            if (! $isApi($request)) {
                return null;
            }

            return ApiResponse::error('The requested resource was not found.', [], 404);
        });

        // Phase 21: a safety net, not a replacement for the four renderers
        // above — this only runs when none of them matched (Laravel checks
        // renderers in registration order and stops at the first non-null
        // result), i.e. for a genuinely unexpected exception. With
        // APP_DEBUG on (local/testing here), returning null falls through
        // to Laravel's own default rendering unchanged, so nothing about
        // local development or the test suite changes. With it off
        // (production), Laravel's default would otherwise put the
        // exception message, file path, and stack trace straight into the
        // JSON response — this replaces that with the same generic
        // envelope every other error already uses.
        $exceptions->render(function (Throwable $e, Request $request) use ($isApi) {
            if (! $isApi($request) || config('app.debug')) {
                return null;
            }

            return ApiResponse::error('Something went wrong. Please try again later.', [], 500);
        });
    })->create();
