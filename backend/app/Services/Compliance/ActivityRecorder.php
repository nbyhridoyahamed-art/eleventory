<?php

namespace App\Services\Compliance;

use App\Models\ActivityLog;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\Auth;

/** Writes a line to the shop's activity log. Never throws: an audit line must not break the action it describes. */
class ActivityRecorder
{
    public static function record(string $action, string $summary, ?int $storeId = null): void
    {
        try {
            $storeId ??= app(TenantContext::class)->storeId();

            if (! $storeId) {
                return;
            }

            ActivityLog::withoutGlobalScopes()->create([
                'store_id' => $storeId,
                'user_id' => Auth::id(),
                'action' => $action,
                'summary' => mb_substr($summary, 0, 255),
                'ip_address' => request()?->ip(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
