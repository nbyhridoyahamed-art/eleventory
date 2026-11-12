<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use App\Services\Billing\BillingService;
use Illuminate\Console\Command;

class BillingMarkPaid extends Command
{
    protected $signature = 'billing:mark-paid {number : Invoice number, e.g. INV-2026-00012}';

    protected $description = 'Record a bank/bKash transfer: mark an invoice paid and activate the plan (manual billing).';

    public function handle(BillingService $billing): int
    {
        $invoice = Invoice::where('number', $this->argument('number'))->first();

        if (! $invoice) {
            $this->error('No such invoice.');

            return self::FAILURE;
        }

        $billing->markPaid($invoice, ['manual' => true, 'recorded_at' => now()->toIso8601String()]);
        $this->info("{$invoice->number} is paid; the plan is active.");

        return self::SUCCESS;
    }
}
