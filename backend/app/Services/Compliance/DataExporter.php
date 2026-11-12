<?php

namespace App\Services\Compliance;

use App\Models\DataExport;
use App\Models\Store;
use App\Models\User;
use App\Services\Tenancy\TenantBackup;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use ZipArchive;

/**
 * A merchant's own data as a zip of CSV files (one per table) plus a README. This is the "give me my
 * data" half of compliance; it reuses TenantBackup's map of which tables belong to a shop, so a new
 * table is exported as soon as backups know about it.
 *
 * Left out on purpose: secrets (passwords, API keys, tokens), which are never handed out even to the owner.
 */
class DataExporter
{
    private const SECRET_COLUMN = '/password|secret|token|api_key|credentials|private_key/i';

    /** Tables that describe the export itself, not shop data. */
    private const SKIP = ['data_exports'];

    public function __construct(private TenantBackup $backup) {}

    /** Seconds the same shop must wait before another export, or 0. */
    public function cooldownRemaining(Store $store): int
    {
        $last = DataExport::withoutGlobalScopes()->where('store_id', $store->id)->latest('id')->first();
        $until = $last?->created_at?->copy()->addMinutes((int) config('compliance.export_cooldown_minutes'));

        return $until && $until->isFuture() ? (int) now()->diffInSeconds($until) : 0;
    }

    public function create(Store $store, ?User $by = null): DataExport
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException('The PHP zip extension is not installed.');
        }

        $disk = Storage::disk('local');
        $path = 'exports/'.$store->uuid.'/'.now()->format('Ymd-His').'-'.bin2hex(random_bytes(6)).'.zip';
        $disk->makeDirectory(dirname($path));
        $target = $disk->path($path);

        $zip = new ZipArchive;
        if ($zip->open($target, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Could not create the export file.');
        }

        $temps = [];
        $summary = [];

        try {
            foreach ($this->backup->allShopTables() as $table) {
                if (in_array($table, self::SKIP, true) || ! Schema::hasTable($table)) {
                    continue;
                }

                $columns = array_values(array_filter(Schema::getColumnListing($table), fn ($c) => ! preg_match(self::SECRET_COLUMN, $c)));
                $file = tempnam(sys_get_temp_dir(), 'exp');
                $temps[] = $file;
                $handle = fopen($file, 'w');
                fwrite($handle, "\xEF\xBB\xBF"); // UTF-8 BOM so spreadsheets read Bengali text correctly
                fputcsv($handle, $columns);

                $rows = 0;
                foreach ($this->backup->rows($table, $store->id)->select($columns)->cursor() as $row) {
                    fputcsv($handle, array_map(fn ($v) => is_scalar($v) || $v === null ? $v : json_encode($v), (array) $row));
                    $rows++;
                }

                fclose($handle);

                if ($rows > 0) {
                    $zip->addFile($file, $table.'.csv');
                    $summary[$table] = $rows;
                }
            }

            $zip->addFromString('README.txt', $this->readme($store, $summary));
            $zip->close();
        } catch (\Throwable $e) {
            @$zip->close();
            @unlink($target);
            throw $e;
        } finally {
            foreach ($temps as $file) {
                @unlink($file);
            }
        }

        return DataExport::create([
            'store_id' => $store->id,
            'requested_by' => $by?->id,
            'status' => 'ready',
            'path' => $path,
            'size' => (int) @filesize($target),
            'expires_at' => now()->addDays((int) config('compliance.export_expiry_days')),
        ]);
    }

    /** Delete files past their expiry (and the rows' file reference). Returns how many. */
    public function prune(): int
    {
        $count = 0;

        DataExport::withoutGlobalScopes()->where('status', 'ready')->where('expires_at', '<', now())->each(function (DataExport $export) use (&$count) {
            if ($export->path) {
                Storage::disk('local')->delete($export->path);
            }
            $export->forceFill(['status' => 'expired', 'path' => null])->save();
            $count++;
        });

        return $count;
    }

    private function readme(Store $store, array $summary): string
    {
        $lines = [
            "Data export for {$store->name}",
            'Made on '.now()->toDayDateTimeString().' UTC',
            '',
            'One CSV file per kind of record, UTF-8, first row = column names. Tables with no rows are left out.',
            'Passwords, API keys, tokens and other secrets are never included.',
            'Uploaded images and files are listed in media.csv (their paths); download them from your media library.',
            '',
            'Files and row counts:',
        ];

        foreach ($summary as $table => $rows) {
            $lines[] = "  {$table}.csv  {$rows}";
        }

        return implode("\n", $lines)."\n";
    }
}
