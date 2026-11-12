<?php

namespace App\Console\Commands;

use App\Models\Store;
use App\Services\Tenancy\TenantBackup;
use Illuminate\Console\Command;

class TenantExport extends Command
{
    protected $signature = 'tenant:export {store? : Store id or uuid} {--all : Every shop} {--out= : File path (single shop only)} {--prune : With --all, delete exports older than BACKUP_RETENTION_DAYS}';

    protected $description = 'Write one shop (or every shop) to an encrypted export file.';

    public function handle(TenantBackup $backup): int
    {
        if ($this->option('all')) {
            foreach (Store::query()->withoutGlobalScopes()->cursor() as $store) {
                $this->line($backup->export($store));
            }

            $this->option('prune') && $this->prune();

            return self::SUCCESS;
        }

        $ref = (string) $this->argument('store');
        $store = Store::query()->withoutGlobalScopes()->where('id', ctype_digit($ref) ? $ref : 0)->orWhere('uuid', $ref)->first();

        if (! $store) {
            $this->error('Store not found. Pass an id or uuid, or --all.');

            return self::FAILURE;
        }

        $this->info($backup->export($store, $this->option('out')));

        return self::SUCCESS;
    }

    private function prune(): void
    {
        $cutoff = now()->subDays((int) config('backup.retention_days'))->timestamp;

        foreach (glob(storage_path('app/backups/tenants/*.tenant')) ?: [] as $file) {
            if (filemtime($file) < $cutoff) {
                unlink($file);
            }
        }
    }
}
