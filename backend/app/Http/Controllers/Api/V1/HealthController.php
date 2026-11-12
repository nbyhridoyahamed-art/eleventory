<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * For uptime monitors and the load balancer: 200 when the things a shop needs are working,
 * 503 when not. It says only which check failed, never why (no hostnames, versions or errors),
 * because anyone can call it.
 */
class HealthController extends Controller
{
    /** The scheduler writes this every minute; older than this means cron/scheduler has stopped. */
    public const SCHEDULER_KEY = 'health:scheduler-heartbeat';

    private const SCHEDULER_STALE_SECONDS = 300;

    public function __invoke(): JsonResponse
    {
        $checks = [
            'database' => $this->check(fn () => DB::select('select 1') !== []),
            'cache' => $this->check(function () {
                Cache::put('health:probe', '1', 30);

                return Cache::get('health:probe') === '1';
            }),
            'queue' => $this->check(fn () => $this->queueBacklogIsSane()),
        ];

        // Only meaningful where a scheduler is expected to be running (the VPS stack, not local dev).
        if (config('health.require_scheduler')) {
            $checks['scheduler'] = $this->check(function () {
                $last = Cache::get(self::SCHEDULER_KEY);

                return $last !== null && now()->timestamp - (int) $last <= self::SCHEDULER_STALE_SECONDS;
            });
        }

        $ok = ! in_array(false, $checks, true);

        return response()->json(['status' => $ok ? 'ok' : 'degraded', 'checks' => $checks], $ok ? 200 : 503);
    }

    private function check(callable $probe): bool
    {
        try {
            return (bool) $probe();
        } catch (Throwable) {
            return false;
        }
    }

    /** Database queue only: jobs piling up unprocessed means the worker is down. Other drivers pass. */
    private function queueBacklogIsSane(): bool
    {
        if (config('queue.default') !== 'database' || ! Schema::hasTable('jobs')) {
            return true;
        }

        $stuck = DB::table('jobs')
            ->where('available_at', '<=', now()->subMinutes((int) config('health.max_job_age_minutes'))->timestamp)
            ->count();

        return $stuck === 0;
    }
}
