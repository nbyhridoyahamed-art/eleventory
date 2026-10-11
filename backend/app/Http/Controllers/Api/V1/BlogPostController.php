<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\SyncsSeoMetadata;
use App\Http\Controllers\Controller;
use App\Http\Requests\BlogPost\BlogPostRequest;
use App\Http\Resources\BlogPostResource;
use App\Http\Resources\BlogPostVersionResource;
use App\Models\BlogPost;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BlogPostController extends Controller
{
    use SyncsSeoMetadata;

    private const SNAPSHOT_FIELDS = [
        'title', 'slug', 'excerpt', 'body', 'featured_image_url', 'status',
    ];

    private const RELATIONS = ['category', 'tags', 'author', 'seoMetadata'];

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', BlogPost::class);

        $posts = BlogPost::query()
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->when($request->filled('search'), fn ($query) => $query->where('title', 'like', '%'.$request->string('search').'%'))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('blog_category_id'), fn ($query) => $query->where('blog_category_id', $request->integer('blog_category_id')))
            ->with(['category', 'tags', 'seoMetadata'])
            ->orderByDesc('published_at')
            ->get();

        return ApiResponse::success(BlogPostResource::collection($posts), 'Blog posts fetched successfully.');
    }

    public function store(BlogPostRequest $request): JsonResponse
    {
        $this->authorize('create', BlogPost::class);

        $data = $request->safe()->except(['tag_ids', 'seo']);
        $data['created_by'] = $request->user()->id;
        $data['status'] ??= 'draft';

        if ($data['status'] === 'published' && empty($data['published_at'])) {
            $data['published_at'] = now();
        }

        $post = BlogPost::create($data);
        $this->syncSeoMetadata($post, $request);

        if ($request->filled('tag_ids')) {
            $post->tags()->sync($request->input('tag_ids'));
        }

        return ApiResponse::success(new BlogPostResource($post->load(self::RELATIONS)), 'Blog post created successfully.', status: 201);
    }

    public function show(BlogPost $blogPost): JsonResponse
    {
        $this->authorize('view', $blogPost);

        return ApiResponse::success(new BlogPostResource($blogPost->load(self::RELATIONS)), 'Blog post fetched successfully.');
    }

    public function update(BlogPostRequest $request, BlogPost $blogPost): JsonResponse
    {
        $this->authorize('update', $blogPost);

        $this->snapshot($blogPost, $request->user()->id);

        $data = $request->safe()->except(['tag_ids', 'seo']);

        if (($data['status'] ?? $blogPost->status) === 'published' && empty($data['published_at'] ?? $blogPost->published_at)) {
            $data['published_at'] = now();
        }

        $blogPost->update($data);
        $this->syncSeoMetadata($blogPost, $request);

        if ($request->has('tag_ids')) {
            $blogPost->tags()->sync($request->input('tag_ids', []));
        }

        return ApiResponse::success(new BlogPostResource($blogPost->load(self::RELATIONS)), 'Blog post updated successfully.');
    }

    public function destroy(BlogPost $blogPost): JsonResponse
    {
        $this->authorize('delete', $blogPost);

        $blogPost->delete();

        return ApiResponse::success(message: 'Blog post deleted successfully.');
    }

    public function versions(BlogPost $blogPost): JsonResponse
    {
        $this->authorize('view', $blogPost);

        $versions = $blogPost->versions()->with('editor')->limit(50)->get();

        return ApiResponse::success(BlogPostVersionResource::collection($versions), 'Blog post versions fetched successfully.');
    }

    public function restoreVersion(Request $request, BlogPost $blogPost, int $version): JsonResponse
    {
        $this->authorize('update', $blogPost);

        $target = $blogPost->versions()->findOrFail($version);

        // Restoring is itself a change worth being able to undo.
        $this->snapshot($blogPost, $request->user()->id);

        $blogPost->update(collect($target->snapshot)->only(self::SNAPSHOT_FIELDS)->toArray());

        return ApiResponse::success(new BlogPostResource($blogPost->load(['category', 'tags', 'author'])), 'Blog post restored successfully.');
    }

    private function snapshot(BlogPost $post, int $userId): void
    {
        $post->versions()->create([
            'store_id' => $post->store_id,
            'snapshot' => collect($post->getAttributes())->only(self::SNAPSHOT_FIELDS)->toArray(),
            'created_by' => $userId,
        ]);
    }
}
