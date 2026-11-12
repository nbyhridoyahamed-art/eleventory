<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\AbuseReport;
use App\Models\PlatformAuditLog;
use App\Models\Store;
use App\Services\Tenancy\StoreResolver;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AbuseReportController extends Controller
{
    /** Public: anyone can report a shop. The shop is found from the host the visitor was on. */
    public function submit(Request $request, StoreResolver $resolver): JsonResponse
    {
        $data = $request->validate([
            'url' => ['nullable', 'string', 'max:500'],
            'reason' => ['required', Rule::in(AbuseReport::REASONS)],
            'details' => ['nullable', 'string', 'max:2000'],
            'email' => ['nullable', 'email', 'max:190'],
            'host' => ['nullable', 'string', 'max:190'],
        ]);

        $store = $data['host'] ?? null ? $resolver->forHost($data['host']) : null;

        AbuseReport::create([
            'store_id' => $store?->id,
            'url' => $data['url'] ?? null,
            'reason' => $data['reason'],
            'details' => $data['details'] ?? null,
            'reporter_email' => $data['email'] ?? null,
        ]);

        return ApiResponse::success(null, 'Thank you. Our team will review this report.', status: 201);
    }

    public function index(Request $request): JsonResponse
    {
        $reports = AbuseReport::with('store:id,name,slug,status')
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->latest('id')->limit(100)->get();

        return ApiResponse::success($reports->map(fn (AbuseReport $r) => [
            'id' => $r->id,
            'store' => $r->store ? ['id' => $r->store->id, 'name' => $r->store->name, 'slug' => $r->store->slug, 'status' => $r->store->status] : null,
            'url' => $r->url,
            'reason' => $r->reason,
            'details' => $r->details,
            'reporter_email' => $r->reporter_email,
            'status' => $r->status,
            'resolution_note' => $r->resolution_note,
            'created_at' => $r->created_at?->toIso8601String(),
        ])->all(), 'Reports fetched successfully.');
    }

    /** Close a report; "actioned" can also suspend the shop in one step. */
    public function resolve(Request $request, AbuseReport $report): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['actioned', 'dismissed'])],
            'note' => ['nullable', 'string', 'max:1000'],
            'suspend_store' => ['boolean'],
        ]);

        $report->update([
            'status' => $data['status'],
            'resolution_note' => $data['note'] ?? null,
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        if ($data['status'] === 'actioned' && ($data['suspend_store'] ?? false) && $report->store_id) {
            Store::find($report->store_id)?->forceFill(['status' => 'suspended', 'suspension_reason' => 'platform'])->save();
            PlatformAuditLog::record($request->user(), 'tenant.suspend', $report->store_id, ['reason' => "Abuse report #{$report->id}"]);
        }

        PlatformAuditLog::record($request->user(), 'report.'.$data['status'], $report->store_id, ['report' => $report->id]);

        return ApiResponse::success(null, 'Report closed.');
    }
}
