<?php

namespace App\Console\Commands;

use App\Services\Tenancy\TenantBackup;
use Illuminate\Console\Command;

class TenantRestore extends Command
{
    protected $signature = 'tenant:restore {file} {--replace : Overwrite the shop if it already has data} {--dry-run : Restore, then roll back: proves the file works without changing anything}';

    protected $description = 'Restore one shop from a tenant export file (all or nothing).';

    public function handle(TenantBackup $backup): int
    {
        try {
            $restored = $backup->restore($this->argument('file'), (bool) $this->option('replace'), (bool) $this->option('dry-run'));
        } catch (\Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->table(['table', 'rows'], collect($restored)->filter()->map(fn ($n, $t) => [$t, $n])->values()->all());
        $this->info($this->option('dry-run') ? 'Dry run OK: the file restores cleanly. Nothing was changed.' : 'Restored.');

        return self::SUCCESS;
    }
}
