<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\SyncsSeoMetadata;
use App\Http\Controllers\Controller;
use App\Http\Requests\Brand\BrandRequest;
use App\Http\Resources\BrandResource;
use App\Models\Brand;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BrandController extends Controller
{
    use SyncsSeoMetadata;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Brand::class);

        $perPage = min((int) $request->integer('per_page', 20), 100);

        $brands = Brand::query()
            ->with('seoMetadata')
            ->withCount('products')
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->orderBy('name')
            ->paginate($perPage);

        return ApiResponse::success(
            BrandResource::collection($brands),
            'Brands fetched successfully.',
            [
                'current_page' => $brands->currentPage(),
                'per_page' => $brands->perPage(),
                'total' => $brands->total(),
                'last_page' => $brands->lastPage(),
            ],
        );
    }

    public function store(BrandRequest $request): JsonResponse
    {
        $this->authorize('create', Brand::class);

        // See CategoryController::store for why this is set explicitly
        // rather than left to the migration's column default.
        $data = $request->safe()->except('seo');
        $data['status'] ??= 'active';

        $brand = Brand::create($data);
        $this->syncSeoMetadata($brand, $request);

        return ApiResponse::success(new BrandResource($brand->load('seoMetadata')), 'Brand created successfully.', status: 201);
    }

    public function show(Brand $brand): JsonResponse
    {
        $this->authorize('view', $brand);

        return ApiResponse::success(new BrandResource($brand->loadCount('products')->load('seoMetadata')), 'Brand fetched successfully.');
    }

    public function update(BrandRequest $request, Brand $brand): JsonResponse
    {
        $this->authorize('update', $brand);

        $brand->update($request->safe()->except('seo'));
        $this->syncSeoMetadata($brand, $request);

        return ApiResponse::success(new BrandResource($brand->load('seoMetadata')), 'Brand updated successfully.');
    }

    public function destroy(Brand $brand): JsonResponse
    {
        $this->authorize('delete', $brand);

        $brand->delete();

        return ApiResponse::success(message: 'Brand deleted successfully.');
    }
}
