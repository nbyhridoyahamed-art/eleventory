<?php

namespace App\Providers;

use App\Contracts\CaptchaVerifier;
use App\Contracts\SmsGateway;
use App\Models\Category;
use App\Models\HomepageBlock;
use App\Models\NotificationLog;
use App\Observers\CategoryObserver;
use App\Observers\HomepageBlockObserver;
use App\Policies\RolePolicy;
use App\Services\Captcha\NullCaptchaVerifier;
use App\Services\Sms\LogSmsGateway;
use App\Support\Tenancy\TenantContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Spatie\Permission\Models\Role;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Phase 19: the one place a real BD SMS provider replaces the log
        // mock — every caller depends on SmsGateway, never LogSmsGateway
        // directly.
        $this->app->bind(SmsGateway::class, LogSmsGateway::class);

        // One tenant context per request/job (see App\Support\Tenancy\TenantContext).
        $this->app->scoped(TenantContext::class);

        // The bot check in front of public sign-up; swap for a real provider when abuse starts.
        $this->app->bind(CaptchaVerifier::class, NullCaptchaVerifier::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Role lives in Spatie's own namespace, so Laravel's policy
        // auto-discovery (which guesses from the MODEL's namespace, not
        // App\Policies) never finds RolePolicy on its own — it must be
        // registered explicitly.
        Gate::policy(Role::class, RolePolicy::class);

        // Email deliveries are written to the notification log here (SMS logs itself in SmsChannel).
        Event::listen(NotificationSent::class, function (NotificationSent $event) {
            if ($event->channel !== 'mail') {
                return;
            }

            $subject = method_exists($event->notification, 'toMail') ? ($event->notification->toMail($event->notifiable)->subject ?? null) : null;

            NotificationLog::create([
                'store_id' => $event->notifiable->store_id ?? null,
                'channel' => 'email',
                'event' => method_exists($event->notification, 'eventKey') ? $event->notification->eventKey() : null,
                'recipient' => (string) ($event->notifiable->email ?? ''),
                'subject' => $subject,
                'status' => 'sent',
            ]);
        });

        // Phase 21: the named limiter `throttle:api` (wired globally in
        // bootstrap/app.php via throttleApi()) resolves to. Every route
        // already under a tighter per-route throttle (login, checkout,
        // etc.) stays governed by that stricter limit; this is only the
        // backstop for the rest of the API. Disabled under the test suite:
        // PHPUnit runs 400+ tests in one process against the array cache
        // driver, all through the in-process test client's shared
        // "127.0.0.1" — without this they'd all share one bucket and start
        // failing with 429s well before the suite finishes. A test that
        // wants to exercise the real limit re-registers it with its own
        // tiny value, which overrides this for that test only.
        RateLimiter::for('api', function (Request $request) {
            if (app()->runningUnitTests()) {
                return Limit::none();
            }

            // The storefront server renders every page from one address, so it
            // authenticates with a shared secret and is exempt from the per-IP limit.
            $ssrKey = (string) config('app.ssr_key');

            if ($ssrKey !== '' && hash_equals($ssrKey, (string) $request->header('X-Storefront-Key'))) {
                return Limit::none();
            }

            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        // Public merchant sign-up. Named limiters, not "throttle:5,60": the
        // numeric shorthand shares ONE counter per IP across every route that
        // uses it, so polling the address check would eat the sign-up allowance.
        RateLimiter::for('merchant-signup', fn (Request $request) => Limit::perHour(5)->by('merchant-signup|'.$request->ip()));
        RateLimiter::for('slug-check', fn (Request $request) => Limit::perMinute(30)->by('slug-check|'.$request->ip()));

        // Phase 22: keeps the storefront's cached category tree
        // (Category::storefrontCacheKey()) from ever going stale after an
        // admin edit — every write here already goes through a model
        // instance (create()/update()/delete()), never a raw query-builder
        // bulk update, so observer events are a reliable place to hook.
        Category::observe(CategoryObserver::class);

        // Same reasoning for the cached storefront homepage — covers
        // HomepageBlockController's store/update/destroy/publish/unpublish/
        // duplicate/restore actions and the scheduled-publish console
        // command, all of which mutate through a model instance.
        // reorder()'s bulk per-ID query-builder update is the one write
        // path this can't see, and invalidates explicitly in the
        // controller instead.
        HomepageBlock::observe(HomepageBlockObserver::class);
    }
}
