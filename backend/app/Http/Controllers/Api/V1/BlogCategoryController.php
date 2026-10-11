<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\SyncsSeoMetadata;
use App\Http\Controllers\Controller;
use App\Http\Requests\BlogCategory\BlogCategoryRequest;
use App\Http\Resources\BlogCategoryResource;
use App\Models\BlogCategory;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BlogCategoryController extends Controller
{
    use SyncsSeoMetadata;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', BlogCategory::class);

        $categories = BlogCategory::query()
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->with('seoMetadata')
            ->withCount('posts')
            ->orderBy('name')
            ->get();

        return ApiResponse::success(BlogCategoryResource::collection($categories), 'Blog categories fetched successfully.');
    }

    public function store(BlogCategoryRequest $request): JsonResponse
    {
        $this->authorize('create', BlogCategory::class);

        $category = BlogCategory::create($request->safe()->except('seo'));
        $this->syncSeoMetadata($category, $request);

        return ApiResponse::success(new BlogCategoryResource($category->load('seoMetadata')), 'Blog category created successfully.', status: 201);
    }

    public function show(BlogCategory $blogCategory): JsonResponse
    {
        $this->authorize('view', $blogCategory);

        return ApiResponse::success(new BlogCategoryResource($blogCategory->loadCount('posts')->load('seoMetadata')), 'Blog category fetched successfully.');
    }

    public function update(BlogCategoryRequest $request, BlogCategory $blogCategory): JsonResponse
    {
        $this->authorize('update', $blogCategory);

        $blogCategory->update($request->safe()->except('seo'));
        $this->syncSeoMetadata($blogCategory, $request);

        return ApiResponse::success(new BlogCategoryResource($blogCategory->load('seoMetadata')), 'Blog category updated successfully.');
    }

    public function destroy(BlogCategory $blogCategory): JsonResponse
    {
        $this->authorize('delete', $blogCategory);

        $blogCategory->delete();

        return ApiResponse::success(message: 'Blog category deleted successfully.');
    }
}
