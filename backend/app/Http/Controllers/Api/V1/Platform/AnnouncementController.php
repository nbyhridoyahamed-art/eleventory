<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\PlatformAuditLog;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Notices from the platform to every merchant dashboard (maintenance, new features, billing changes). */
class AnnouncementController extends Controller
{
    /** For every signed-in merchant: what is live now. */
    public function live(): JsonResponse
    {
        return ApiResponse::success(
            Announcement::live()->latest('id')->limit(5)->get(['id', 'title', 'body', 'level'])->all(),
            'Announcements fetched successfully.',
        );
    }

    public function index(): JsonResponse
    {
        return ApiResponse::success(Announcement::latest('id')->limit(100)->get()->all(), 'Announcements fetched successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $announcement = Announcement::create($this->validated($request) + ['created_by' => $request->user()->id]);
        PlatformAuditLog::record($request->user(), 'announcement.create', null, ['id' => $announcement->id, 'title' => $announcement->title]);

        return ApiResponse::success($announcement, 'Announcement created.', status: 201);
    }

    public function update(Request $request, Announcement $announcement): JsonResponse
    {
        $announcement->update($this->validated($request));
        PlatformAuditLog::record($request->user(), 'announcement.update', null, ['id' => $announcement->id]);

        return ApiResponse::success($announcement->fresh(), 'Announcement updated.');
    }

    public function destroy(Request $request, Announcement $announcement): JsonResponse
    {
        $announcement->delete();
        PlatformAuditLog::record($request->user(), 'announcement.delete', null, ['id' => $announcement->id]);

        return ApiResponse::success(null, 'Announcement deleted.');
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'body' => ['required', 'string', 'max:2000'],
            'level' => ['required', 'in:info,warning,critical'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['boolean'],
        ]);
    }
}
