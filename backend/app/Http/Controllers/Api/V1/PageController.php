<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\SyncsSeoMetadata;
use App\Http\Controllers\Controller;
use App\Http\Requests\Page\PageRequest;
use App\Http\Resources\PageResource;
use App\Models\Page;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PageController extends Controller
{
    use SyncsSeoMetadata;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Page::class);

        $pages = Page::query()
            ->with('seoMetadata')
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->when($request->filled('search'), fn ($query) => $query->where('title', 'like', '%'.$request->string('search').'%'))
            ->orderBy('title')
            ->get();

        return ApiResponse::success(PageResource::collection($pages), 'Pages fetched successfully.');
    }

    public function store(PageRequest $request): JsonResponse
    {
        $this->authorize('create', Page::class);

        $data = $request->safe()->except('seo');
        $data['status'] ??= 'draft';
        $data['created_by'] = $request->user()->id;

        $page = Page::create($data);
        $this->syncSeoMetadata($page, $request);

        return ApiResponse::success(new PageResource($page->load('seoMetadata')), 'Page created successfully.', status: 201);
    }

    public function show(Page $page): JsonResponse
    {
        $this->authorize('view', $page);

        return ApiResponse::success(new PageResource($page->load(['creator', 'seoMetadata'])), 'Page fetched successfully.');
    }

    public function update(PageRequest $request, Page $page): JsonResponse
    {
        $this->authorize('update', $page);

        $page->update($request->safe()->except('seo'));
        $this->syncSeoMetadata($page, $request);

        return ApiResponse::success(new PageResource($page->load('seoMetadata')), 'Page updated successfully.');
    }

    public function destroy(Page $page): JsonResponse
    {
        $this->authorize('delete', $page);

        $page->delete();

        return ApiResponse::success(message: 'Page deleted successfully.');
    }
}
