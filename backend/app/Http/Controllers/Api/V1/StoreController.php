<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Store\StoreRequest;
use App\Http\Resources\StoreResource;
use App\Models\Store;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StoreController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Store::class);

        $perPage = min((int) $request->integer('per_page', 20), 100);

        $stores = Store::query()
            ->with('currency')
            ->when(config('app.saas_mode') && ! $request->user()->hasRole('Platform Admin'),
                fn ($query) => $query->whereIn('id', $request->user()->stores()->wherePivot('status', 'active')->select('stores.id')))
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->latest()
            ->paginate($perPage);

        return ApiResponse::success(
            StoreResource::collection($stores),
            'Stores fetched successfully.',
            [
                'current_page' => $stores->currentPage(),
                'per_page' => $stores->perPage(),
                'total' => $stores->total(),
                'last_page' => $stores->lastPage(),
            ],
        );
    }

    public function store(StoreRequest $request): JsonResponse
    {
        $this->authorize('create', Store::class);

        // Set explicitly rather than leaning on the migration's column
        // default: create() returns the in-memory model, not a fresh
        // SELECT, so a field left for the DB default would come back
        // null in this response even though the row has the real value.
        $data = $request->validated();
        $data['status'] ??= 'active';

        $store = Store::create($data);

        return ApiResponse::success(new StoreResource($store->load('currency')), 'Store created successfully.', status: 201);
    }

    public function show(Store $store): JsonResponse
    {
        $this->authorize('view', $store);

        return ApiResponse::success(new StoreResource($store->load('currency')), 'Store fetched successfully.');
    }

    public function update(StoreRequest $request, Store $store): JsonResponse
    {
        $this->authorize('update', $store);

        $store->update($request->validated());

        return ApiResponse::success(new StoreResource($store->load('currency')), 'Store updated successfully.');
    }

    public function destroy(Store $store): JsonResponse
    {
        $this->authorize('delete', $store);

        $store->delete();

        return ApiResponse::success(message: 'Store deleted successfully.');
    }
}
