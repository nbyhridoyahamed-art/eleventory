<?php

namespace App\Console\Commands;

use App\Models\Organization;
use App\Services\Compliance\AccountDeletion;
use App\Services\Compliance\DataExporter;
use Illuminate\Console\Command;

class AccountPurge extends Command
{
    protected $signature = 'account:purge {organization? : Purge this organization id now (it must have asked for deletion)} {--dry-run : List what is due without deleting}';

    protected $description = 'Permanently delete accounts whose deletion grace period is over, and remove expired data exports.';

    public function handle(AccountDeletion $deletion, DataExporter $exporter): int
    {
        $due = $this->argument('organization')
            ? Organization::whereKey($this->argument('organization'))->get()
            : $deletion->due();

        foreach ($due as $organization) {
            if (! $organization->deletion_requested_at || $organization->purged_at) {
                $this->warn("Organization {$organization->id} has not asked for deletion or is already purged; skipped.");

                continue;
            }

            if ($this->option('dry-run')) {
                $this->line("Would purge organization {$organization->id} ({$organization->name}), requested {$organization->deletion_requested_at}.");

                continue;
            }

            $summary = $deletion->purge($organization);
            $this->info("Purged organization {$organization->id}: ".json_encode($summary));
        }

        if (! $this->option('dry-run')) {
            $this->line('Expired exports removed: '.$exporter->prune());
            \App\Models\ActivityLog::withoutGlobalScopes()->where('created_at', '<', now()->subDays((int) config('compliance.activity_retention_days')))->delete();
        }

        return self::SUCCESS;
    }
}
