<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Placeholder for plans and billing (Phase 5): which plan an account is on
     * and when its trial ends. Null for accounts that predate sign-up (the
     * original store), which are never treated as trials.
     */
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('plan', 40)->nullable()->after('status');
            $table->timestamp('trial_ends_at')->nullable()->after('plan');
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn(['plan', 'trial_ends_at']);
        });
    }
};
