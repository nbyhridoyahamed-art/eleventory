<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\PlatformAuditLog;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $logs = PlatformAuditLog::with(['actor:id,name,email', 'store:id,name'])
            ->when($request->query('store_id'), fn ($q, $id) => $q->where('store_id', (int) $id))
            ->latest('id')->limit(200)->get();

        return ApiResponse::success($logs->map(fn (PlatformAuditLog $l) => [
            'id' => $l->id,
            'action' => $l->action,
            'actor' => $l->actor?->name,
            'store' => $l->store ? ['id' => $l->store->id, 'name' => $l->store->name] : null,
            'meta' => $l->meta,
            'ip' => $l->ip,
            'created_at' => $l->created_at?->toIso8601String(),
        ])->all(), 'Audit log fetched successfully.');
    }
}
