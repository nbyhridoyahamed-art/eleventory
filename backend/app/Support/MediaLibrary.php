<?php

namespace App\Support;

use App\Models\Media;
use App\Models\Store;
use App\Services\Billing\PlanLimits;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * The one place a file actually lands on disk, so every upload path —
 * the reusable Media Library's own upload, the legacy folder-based
 * UploadController, and ProductImageController's gallery upload — ends up
 * as a real, reusable `media` row instead of three copies of the same
 * Str::uuid()-filename-plus-storeAs() logic drifting apart over time.
 *
 * Phase 8: in SaaS mode every file lives under tenants/{store_uuid}/ on the
 * configured media disk (local "public" by default, or an S3/R2 bucket), so one
 * shop's files can be sized, exported or removed as a unit, and a plan's storage
 * quota is enforced before the file is written. With SAAS_MODE off the layout is
 * exactly what it always was (folder/ on the public disk).
 */
class MediaLibrary
{
    /** Prefix every shop's files share when the platform hosts many shops. */
    public const TENANT_PREFIX = 'tenants/';

    public static function store(UploadedFile $file, int $storeId, ?int $uploadedBy, string $folder = 'media'): Media
    {
        app(PlanLimits::class)->assertStorage($storeId, (int) $file->getSize());

        $disk = self::disk();
        $filename = Str::uuid().'.'.$file->getClientOriginalExtension();
        $path = $file->storeAs(self::directory($storeId, $folder), $filename, $disk);

        return Media::create([
            'store_id' => $storeId,
            'disk' => $disk,
            'path' => $path,
            'filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'size' => $file->getSize(),
            'uploaded_by' => $uploadedBy,
        ]);
    }

    /** The disk new uploads go to (MEDIA_DISK). Existing files keep the disk recorded on their row. */
    public static function disk(): string
    {
        return (string) config('media.disk', 'public');
    }

    /** Folder a new file goes into: tenants/{store_uuid}/{folder} in SaaS mode, {folder} otherwise. */
    public static function directory(int $storeId, string $folder): string
    {
        $folder = trim($folder, '/');

        if (! config('app.saas_mode')) {
            return $folder;
        }

        $uuid = Store::query()->withoutGlobalScopes()->whereKey($storeId)->value('uuid');

        return $uuid ? self::TENANT_PREFIX.$uuid.'/'.$folder : $folder;
    }

    /**
     * Public URL for a stored path. Files uploaded before tenant folders (and every file when
     * SaaS mode is off) are on the public disk; tenant files are on the media disk.
     */
    public static function url(string $path): string
    {
        $disk = str_starts_with($path, self::TENANT_PREFIX) ? self::disk() : 'public';

        return Storage::disk($disk)->url($path);
    }
}
