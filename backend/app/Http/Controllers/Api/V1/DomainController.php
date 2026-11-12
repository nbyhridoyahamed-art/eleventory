<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Models\StoreDomain;
use App\Services\Tenancy\DomainManager;
use App\Support\ApiResponse;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The signed-in store's custom domains. Route-model binding is tenant-scoped, so
 * another store's domain is a 404 here.
 */
class DomainController extends Controller
{
    public function __construct(private DomainManager $domains) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $store = $this->currentStore($request);

        return ApiResponse::success([
            'free_address' => $this->freeAddress($store),
            'cname_target' => config('tenancy.cname_target') ?: null,
            'limit' => (int) config('tenancy.max_domains', 5),
            'domains' => StoreDomain::where('store_id', $store->id)->orderByDesc('is_primary')->orderBy('id')->get()
                ->map(fn (StoreDomain $domain) => $this->present($domain))->all(),
        ], 'Domains fetched successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);
        $data = $request->validate(['domain' => ['required', 'string', 'max:300']]);

        $domain = $this->domains->add($this->currentStore($request), $data['domain']);

        \App\Services\Compliance\ActivityRecorder::record('domain.added', 'Added domain '.$domain->domain);

        return ApiResponse::success($this->present($domain), 'Domain added successfully.', status: 201);
    }

    public function verify(Request $request, StoreDomain $storeDomain): JsonResponse
    {
        $this->authorizeManage($request);

        return ApiResponse::success($this->present($this->domains->verify($storeDomain)), 'Domain checked.');
    }

    public function primary(Request $request, StoreDomain $storeDomain): JsonResponse
    {
        $this->authorizeManage($request);

        return ApiResponse::success($this->present($this->domains->makePrimary($storeDomain)), 'Primary domain updated.');
    }

    public function destroy(Request $request, StoreDomain $storeDomain): JsonResponse
    {
        $this->authorizeManage($request);
        $removed = $storeDomain->domain;
        $this->domains->remove($storeDomain);
        \App\Services\Compliance\ActivityRecorder::record('domain.removed', 'Removed domain '.$removed);

        return ApiResponse::success(null, 'Domain removed successfully.');
    }

    private function authorizeManage(Request $request): void
    {
        if (! $request->user()->can('settings.manage')) {
            throw new AuthorizationException;
        }
    }

    private function currentStore(Request $request): Store
    {
        $storeId = app(TenantContext::class)->storeId() ?? (int) $request->user()->current_store_id;

        return Store::query()->findOrFail($storeId);
    }

    private function freeAddress(Store $store): ?string
    {
        $platform = config('app.platform_domain');

        return $platform ? "{$store->slug}.{$platform}" : null;
    }

    private function present(StoreDomain $domain): array
    {
        return [
            'id' => $domain->id,
            'domain' => $domain->domain,
            'status' => $domain->status,
            'is_primary' => $domain->is_primary,
            'verification' => ['name' => $domain->txtName(), 'value' => $domain->txtValue()],
            'points_here' => $domain->points_here,
            'last_checked_at' => $domain->last_checked_at?->toIso8601String(),
            'last_error' => $domain->last_error,
            'verified_at' => $domain->verified_at?->toIso8601String(),
            'created_at' => $domain->created_at?->toIso8601String(),
        ];
    }
}
