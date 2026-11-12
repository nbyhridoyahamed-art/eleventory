<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('homepage-blocks:publish-scheduled')->everyFiveMinutes();
Schedule::command('billing:run')->dailyAt('02:00');

// Phase 8: proves the scheduler is alive; GET /api/v1/health reads this (HEALTH_REQUIRE_SCHEDULER).
Schedule::call(fn () => \Illuminate\Support\Facades\Cache::put(\App\Http\Controllers\Api\V1\HealthController::SCHEDULER_KEY, now()->timestamp, 600))->everyMinute()->name('health-heartbeat');

// Phase 8: nightly per-shop exports (off until BACKUP_TENANT_EXPORTS=true; a whole-database dump is deploy/vps/backup.sh).
Schedule::command('tenant:export --all --prune')->dailyAt('03:30')->when(fn () => config('backup.tenant_exports'));
