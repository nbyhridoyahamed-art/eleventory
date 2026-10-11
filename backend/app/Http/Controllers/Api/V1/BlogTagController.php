<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\SyncsSeoMetadata;
use App\Http\Controllers\Controller;
use App\Http\Requests\BlogTag\BlogTagRequest;
use App\Http\Resources\BlogTagResource;
use App\Models\BlogTag;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BlogTagController extends Controller
{
    use SyncsSeoMetadata;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', BlogTag::class);

        $tags = BlogTag::query()
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->with('seoMetadata')
            ->withCount('posts')
            ->orderBy('name')
            ->get();

        return ApiResponse::success(BlogTagResource::collection($tags), 'Blog tags fetched successfully.');
    }

    public function store(BlogTagRequest $request): JsonResponse
    {
        $this->authorize('create', BlogTag::class);

        $tag = BlogTag::create($request->safe()->except('seo'));
        $this->syncSeoMetadata($tag, $request);

        return ApiResponse::success(new BlogTagResource($tag->load('seoMetadata')), 'Blog tag created successfully.', status: 201);
    }

    public function show(BlogTag $blogTag): JsonResponse
    {
        $this->authorize('view', $blogTag);

        return ApiResponse::success(new BlogTagResource($blogTag->loadCount('posts')->load('seoMetadata')), 'Blog tag fetched successfully.');
    }

    public function update(BlogTagRequest $request, BlogTag $blogTag): JsonResponse
    {
        $this->authorize('update', $blogTag);

        $blogTag->update($request->safe()->except('seo'));
        $this->syncSeoMetadata($blogTag, $request);

        return ApiResponse::success(new BlogTagResource($blogTag->load('seoMetadata')), 'Blog tag updated successfully.');
    }

    public function destroy(BlogTag $blogTag): JsonResponse
    {
        $this->authorize('delete', $blogTag);

        $blogTag->delete();

        return ApiResponse::success(message: 'Blog tag deleted successfully.');
    }
}
