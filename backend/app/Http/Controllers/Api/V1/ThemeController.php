<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Media;
use App\Models\Store;
use App\Models\StoreTheme;
use App\Services\Billing\PlanLimits;
use App\Services\Themes\ThemeService;
use App\Support\ApiResponse;
use App\Support\MediaLibrary;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** The store owner's theme: edit a draft, preview it, publish it. */
class ThemeController extends Controller
{
    public function __construct(private ThemeService $themes, private PlanLimits $limits) {}

    public function show(Request $request): JsonResponse
    {
        return $this->respond($this->theme($request));
    }

    public function update(Request $request): JsonResponse
    {
        $storeId = $this->storeId($request);

        $data = $request->validate([
            'preset' => ['required', Rule::in(array_keys(ThemeService::PRESETS))],
            'colors.nav' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'colors.accent' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'radius' => ['required', Rule::in(array_keys(ThemeService::RADII))],
            'font' => ['required', Rule::in(array_keys(ThemeService::FONTS))],
            'topbar' => ['required', 'boolean'],
            'logo_media_id' => ['nullable', 'integer'],
            'favicon_media_id' => ['nullable', 'integer'],
            'custom_css' => ['nullable', 'string'],
        ], ['colors.nav.regex' => 'Use a colour like #0b3f91.', 'colors.accent.regex' => 'Use a colour like #ffa800.']);

        foreach (['logo_media_id', 'favicon_media_id'] as $field) {
            if (! empty($data[$field]) && ! Media::query()->withoutGlobalScopes()->where('store_id', $storeId)->whereKey($data[$field])->exists()) {
                throw ValidationException::withMessages([$field => 'Choose a file from your own media library.']);
            }
        }

        if (! empty($data['custom_css']) && trim($data['custom_css']) !== '') {
            $this->limits->assertFeature($storeId, 'custom_css');
            $data['custom_css'] = $this->themes->sanitizeCss($data['custom_css']);
        }

        $theme = $this->theme($request);
        $theme->update(['draft' => $this->themes->clean($data)]);

        return $this->respond($theme->refresh(), 'Draft saved.');
    }

    public function publish(Request $request): JsonResponse
    {
        $theme = $this->theme($request);

        // Re-check at publish time: the plan may have changed since the draft was saved.
        if (! empty($theme->draft['custom_css'])) {
            $this->limits->assertFeature($theme->store_id, 'custom_css');
            $theme->update(['draft' => [...$theme->draft, 'custom_css' => $this->themes->sanitizeCss($theme->draft['custom_css'])]]);
        }

        return $this->respond($this->themes->publish($theme->refresh()), 'Theme published.');
    }

    public function discard(Request $request): JsonResponse
    {
        return $this->respond($this->themes->discard($this->theme($request)), 'Draft discarded.');
    }

    private function respond(StoreTheme $theme, string $message = 'Theme fetched successfully.'): JsonResponse
    {
        $store = Store::query()->withoutGlobalScopes()->findOrFail($theme->store_id);
        $organization = $this->limits->organizationForStore($store->id);

        return ApiResponse::success([
            'draft' => $theme->draft,
            'published' => $theme->published,
            'has_unpublished_changes' => $this->themes->hasUnpublishedChanges($theme),
            'published_at' => $theme->published_at?->toIso8601String(),
            'presets' => collect(ThemeService::PRESETS)->map(fn ($p, $key) => ['key' => $key] + $p)->values()->all(),
            'fonts' => collect(ThemeService::FONTS)->map(fn ($f, $key) => ['key' => $key, 'label' => $f['label']])->values()->all(),
            'can_custom_css' => ! $organization || $this->limits->feature($organization, 'custom_css'),
            'logo_url' => $this->mediaUrl($theme->store_id, $theme->draft['logo_media_id'] ?? null),
            'favicon_url' => $this->mediaUrl($theme->store_id, $theme->draft['favicon_media_id'] ?? null),
            'preview_token' => $theme->preview_token,
            'storefront_url' => $this->themes->storefrontUrl($store),
        ], $message);
    }

    private function mediaUrl(int $storeId, ?int $mediaId): ?string
    {
        $media = $mediaId ? Media::query()->withoutGlobalScopes()->where('store_id', $storeId)->find($mediaId) : null;

        return $media ? MediaLibrary::url($media->path) : null;
    }

    private function theme(Request $request): StoreTheme
    {
        $theme = $this->themes->forStore($this->storeId($request));

        // The token is hidden from casual serialisation; the owner's own screen needs it.
        return $theme->makeVisible('preview_token');
    }

    private function storeId(Request $request): int
    {
        if (! $request->user()->can('settings.manage')) {
            throw new AuthorizationException;
        }

        return (int) (app(TenantContext::class)->storeId() ?? $request->user()->current_store_id);
    }
}
