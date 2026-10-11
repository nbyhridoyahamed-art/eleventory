<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\CourierRequest;
use App\Http\Resources\CourierResource;
use App\Models\Courier;
use App\Services\Couriers\CourierApiException;
use App\Services\Couriers\SteadfastClient;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Courier::class);

        $perPage = min((int) $request->integer('per_page', 20), 100);

        $couriers = Courier::query()
            ->withCount('shipments')
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->orderBy('name')
            ->paginate($perPage);

        return ApiResponse::success(
            CourierResource::collection($couriers),
            'Couriers fetched successfully.',
            [
                'current_page' => $couriers->currentPage(),
                'per_page' => $couriers->perPage(),
                'total' => $couriers->total(),
                'last_page' => $couriers->lastPage(),
            ],
        );
    }

    public function store(CourierRequest $request): JsonResponse
    {
        $this->authorize('create', Courier::class);

        $data = $request->validated();
        $data['status'] ??= 'active';
        $data['provider'] ??= 'manual';

        $courier = Courier::create($data);

        return ApiResponse::success(new CourierResource($courier), 'Courier created successfully.', status: 201);
    }

    public function show(Courier $courier): JsonResponse
    {
        $this->authorize('view', $courier);

        return ApiResponse::success(new CourierResource($courier->loadCount('shipments')), 'Courier fetched successfully.');
    }

    public function update(CourierRequest $request, Courier $courier): JsonResponse
    {
        $this->authorize('update', $courier);

        // A blank key/secret field means "keep what is stored".
        $data = array_filter($request->validated(), fn ($value, $key) => ! in_array($key, ['api_key', 'api_secret'], true) || filled($value), ARRAY_FILTER_USE_BOTH);

        if (($data['provider'] ?? $courier->provider) === 'manual') {
            $data['api_key'] = null;
            $data['api_secret'] = null;
        }

        $courier->update($data);

        return ApiResponse::success(new CourierResource($courier), 'Courier updated successfully.');
    }

    /** Verifies the saved Steadfast credentials by reading the account balance. */
    public function testConnection(Courier $courier, SteadfastClient $steadfast): JsonResponse
    {
        $this->authorize('update', $courier);

        if ($courier->provider !== 'steadfast' || blank($courier->api_key)) {
            return ApiResponse::error('This courier is not connected to Steadfast.', [], 422);
        }

        try {
            $balance = $steadfast->balance($courier);
        } catch (CourierApiException $exception) {
            return ApiResponse::error($exception->getMessage(), [], 422);
        }

        return ApiResponse::success(['balance' => $balance], 'Connected to Steadfast.');
    }

    public function destroy(Courier $courier): JsonResponse
    {
        $this->authorize('delete', $courier);

        $courier->delete();

        return ApiResponse::success(message: 'Courier deleted successfully.');
    }
}
