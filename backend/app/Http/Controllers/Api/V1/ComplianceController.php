<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\DataExport;
use App\Models\LegalAcceptance;
use App\Models\Organization;
use App\Models\Store;
use App\Notifications\ServiceNoticeNotification;
use App\Services\Compliance\AccountDeletion;
use App\Services\Compliance\ActivityRecorder;
use App\Services\Compliance\DataExporter;
use App\Support\ApiResponse;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * What an account owner can do about their own data: download it, ask for it to be deleted, and
 * see who did what in the dashboard. Exports and deletion are for the store's owner only.
 */
class ComplianceController extends Controller
{
    public function __construct(private DataExporter $exporter, private AccountDeletion $deletion) {}

    public function show(Request $request): JsonResponse
    {
        $store = $this->store($request);
        $organization = $store->organization;
        $isOwner = $this->isOwner($request, $store);

        return ApiResponse::success([
            'is_owner' => $isOwner,
            'exports' => DataExport::where('status', 'ready')->latest('id')->limit(10)->get()->map(fn (DataExport $e) => [
                'id' => $e->id,
                'size' => $e->size,
                'created_at' => $e->created_at?->toIso8601String(),
                'expires_at' => $e->expires_at?->toIso8601String(),
                'downloadable' => $e->isDownloadable(),
            ])->all(),
            'export_cooldown_seconds' => $this->exporter->cooldownRemaining($store),
            'deletion' => [
                'requested_at' => $organization?->deletion_requested_at?->toIso8601String(),
                'purge_at' => $organization?->deletion_requested_at ? $this->deletion->purgeDate($organization)->toIso8601String() : null,
                'grace_days' => (int) config('compliance.deletion_grace_days'),
            ],
        ], 'Data settings fetched successfully.');
    }

    public function createExport(Request $request): JsonResponse
    {
        $store = $this->store($request);
        $this->ownerOnly($request, $store);

        if ($wait = $this->exporter->cooldownRemaining($store)) {
            return ApiResponse::error('An export was made recently. Please wait before making another.', ['export' => ['Try again in '.ceil($wait / 60).' minute(s).']], 429);
        }

        $export = $this->exporter->create($store, $request->user());
        ActivityRecorder::record('data.exported', 'Made a data export');

        if (config('compliance.send_emails') && $store->organization?->email) {
            try {
                Notification::route('mail', $store->organization->email)->notify(new ServiceNoticeNotification(
                    'Your data export is ready',
                    ['The export of '.$store->name.' is ready to download. It stays available until '.$export->expires_at->toFormattedDateString().'.'],
                    'Download export',
                    '/dashboard/settings/data',
                ));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return ApiResponse::success(['id' => $export->id, 'size' => $export->size, 'expires_at' => $export->expires_at->toIso8601String()], 'Your export is ready.', status: 201);
    }

    public function download(Request $request, DataExport $dataExport): StreamedResponse
    {
        $this->ownerOnly($request, $this->store($request));
        abort_unless($dataExport->isDownloadable() && Storage::disk('local')->exists($dataExport->path), 404, 'This export has expired.');

        ActivityRecorder::record('data.downloaded', 'Downloaded a data export');

        return Storage::disk('local')->download($dataExport->path, 'store-export-'.$dataExport->created_at->format('Ymd').'.zip');
    }

    public function requestDeletion(Request $request): JsonResponse
    {
        $store = $this->store($request);
        $this->ownerOnly($request, $store);
        $data = $request->validate(['password' => ['required', 'string'], 'confirm' => ['required', 'string']]);

        if (! Hash::check($data['password'], $request->user()->password)) {
            throw ValidationException::withMessages(['password' => ['That password is not correct.']]);
        }

        if (trim($data['confirm']) !== $store->slug) {
            throw ValidationException::withMessages(['confirm' => ['Type your store address ('.$store->slug.') exactly to confirm.']]);
        }

        $organization = $this->organization($store);
        $this->deletion->request($organization, $request->user());
        ActivityRecorder::record('account.deletion_requested', 'Asked to delete the account');

        return ApiResponse::success($this->deletionState($organization->refresh()), 'Your account is scheduled for deletion.');
    }

    public function cancelDeletion(Request $request): JsonResponse
    {
        $store = $this->store($request);
        $this->ownerOnly($request, $store);
        $organization = $this->organization($store);

        $this->deletion->cancel($organization, $request->user());
        ActivityRecorder::record('account.deletion_cancelled', 'Cancelled the account deletion');

        return ApiResponse::success($this->deletionState($organization->refresh()), 'Deletion cancelled. Your store is back online.');
    }

    public function activity(Request $request): JsonResponse
    {
        if (! $request->user()->can('settings.manage')) {
            throw new AuthorizationException;
        }

        $page = ActivityLog::with('user:id,name,email')->latest('id')->paginate(min(100, max(10, (int) $request->query('per_page', 50))));

        return ApiResponse::success([
            'data' => $page->getCollection()->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'summary' => $log->summary,
                'user' => $log->user ? ['name' => $log->user->name, 'email' => $log->user->email] : null,
                'ip' => $log->ip_address,
                'created_at' => $log->created_at?->toIso8601String(),
            ])->all(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ], 'Activity fetched successfully.');
    }

    /** Which legal document versions this person still has to accept. Not store-scoped: it is about the person. */
    public function legalStatus(Request $request): JsonResponse
    {
        $version = (string) config('legal.version');
        $accepted = LegalAcceptance::where('user_id', $request->user()->id)->where('version', $version)->pluck('document')->all();

        return ApiResponse::success([
            'version' => $version,
            'documents' => config('legal.documents'),
            'pending' => array_values(array_diff(config('legal.documents'), $accepted)),
        ], 'Legal status fetched successfully.');
    }

    public function acceptLegal(Request $request): JsonResponse
    {
        $request->validate(['accept' => ['accepted']]);

        self::recordAcceptance($request->user()->id, $request->ip());

        return $this->legalStatus($request);
    }

    /** Record that a person accepted the current version of every document (once per version). */
    public static function recordAcceptance(int $userId, ?string $ip): void
    {
        $version = (string) config('legal.version');

        foreach (config('legal.documents') as $document) {
            LegalAcceptance::firstOrCreate(
                ['user_id' => $userId, 'document' => $document, 'version' => $version],
                ['accepted_at' => now(), 'ip' => $ip],
            );
        }
    }

    private function deletionState(Organization $organization): array
    {
        return [
            'requested_at' => $organization->deletion_requested_at?->toIso8601String(),
            'purge_at' => $organization->deletion_requested_at ? $this->deletion->purgeDate($organization)->toIso8601String() : null,
            'grace_days' => (int) config('compliance.deletion_grace_days'),
        ];
    }

    private function store(Request $request): Store
    {
        $storeId = app(TenantContext::class)->storeId() ?? (int) $request->user()->current_store_id;

        return Store::query()->with('organization')->findOrFail($storeId);
    }

    private function organization(Store $store): Organization
    {
        return $store->organization ?? throw new AuthorizationException('This store has no account to delete.');
    }

    private function isOwner(Request $request, Store $store): bool
    {
        return $store->users()->where('users.id', $request->user()->id)->wherePivot('is_owner', true)->exists();
    }

    private function ownerOnly(Request $request, Store $store): void
    {
        if (! $this->isOwner($request, $store)) {
            throw new AuthorizationException('Only the store owner can do this.');
        }
    }
}
