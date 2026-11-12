<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 8: file storage becomes a plan limit (megabytes of uploaded media per account).
 * Starting values are PLACEHOLDERS, editable per plan by the platform; null = unlimited, which
 * is what the founding/legacy plan keeps. Nothing is enforced unless SAAS_MODE is on.
 */
return new class extends Migration
{
    private array $storage = ['starter' => 1024, 'growth' => 10240, 'pro' => 51200, 'legacy' => null];

    public function up(): void
    {
        foreach ($this->storage as $key => $megabytes) {
            $plan = DB::table('plans')->where('key', $key)->first();

            if (! $plan) {
                continue;
            }

            $limits = json_decode($plan->limits, true) ?: [];
            $limits['storage_mb'] = $megabytes;
            DB::table('plans')->where('id', $plan->id)->update(['limits' => json_encode($limits)]);
        }
    }

    public function down(): void
    {
        foreach (DB::table('plans')->get() as $plan) {
            $limits = json_decode($plan->limits, true) ?: [];
            unset($limits['storage_mb']);
            DB::table('plans')->where('id', $plan->id)->update(['limits' => json_encode($limits)]);
        }
    }
};
