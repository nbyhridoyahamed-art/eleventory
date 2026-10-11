<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\SyncsSeoMetadata;
use App\Http\Controllers\Controller;
use App\Http\Requests\Category\CategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    use SyncsSeoMetadata;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Category::class);

        $categories = Category::query()
            ->with('seoMetadata')
            ->withCount('products')
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%'.$request->string('search').'%'))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return ApiResponse::success(CategoryResource::collection($categories), 'Categories fetched successfully.');
    }

    public function store(CategoryRequest $request): JsonResponse
    {
        $this->authorize('create', Category::class);

        // Set explicitly rather than leaning on the migration's column
        // defaults: create() returns the in-memory model, not a fresh
        // SELECT, so a field left for the DB default would come back
        // null in this response even though the row has the real value.
        $data = $request->safe()->except('seo');
        $data['status'] ??= 'active';
        $data['sort_order'] ??= 0;

        $category = Category::create($data);
        $this->syncSeoMetadata($category, $request);

        return ApiResponse::success(new CategoryResource($category->load('seoMetadata')), 'Category created successfully.', status: 201);
    }

    public function show(Category $category): JsonResponse
    {
        $this->authorize('view', $category);

        return ApiResponse::success(new CategoryResource($category->loadCount('products')->load('seoMetadata')), 'Category fetched successfully.');
    }

    public function update(CategoryRequest $request, Category $category): JsonResponse
    {
        $this->authorize('update', $category);

        $category->update($request->safe()->except('seo'));
        $this->syncSeoMetadata($category, $request);

        return ApiResponse::success(new CategoryResource($category->load('seoMetadata')), 'Category updated successfully.');
    }

    public function destroy(Category $category): JsonResponse
    {
        $this->authorize('delete', $category);

        if ($category->children()->exists()) {
            return ApiResponse::error('Move or delete its subcategories first.', [], 422);
        }

        $category->delete();

        return ApiResponse::success(message: 'Category deleted successfully.');
    }
}
