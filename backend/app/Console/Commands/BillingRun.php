<?php

namespace App\Console\Commands;

use App\Services\Billing\BillingService;
use Illuminate\Console\Command;

class BillingRun extends Command
{
    protected $signature = 'billing:run';

    protected $description = 'Daily billing clock: end trials, issue renewal invoices, apply grace periods, suspend, send reminders.';

    public function handle(BillingService $billing): int
    {
        $done = $billing->runLifecycle();

        foreach ($done as $what => $count) {
            $this->line(str_pad($what, 14).$count);
        }

        return self::SUCCESS;
    }
}
