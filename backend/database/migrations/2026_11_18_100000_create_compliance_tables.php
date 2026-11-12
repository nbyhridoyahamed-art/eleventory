<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 10: proof of what each person accepted, merchants' data exports, and account deletion state.
 */
return new class extends Migration
{
    public function up(): void
    {
        // One row each time someone accepts a version of a legal document (sign-up, and re-acceptance after a change).
        Schema::create('legal_acceptances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('document', 20); // terms | privacy | dpa
            $table->string('version', 40);
            $table->timestamp('accepted_at');
            $table->string('ip', 45)->nullable();

            $table->index(['user_id', 'document']);
        });

        // A zip of a shop's data (CSV files) made on request, kept for a few days.
        Schema::create('data_exports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 16)->default('ready'); // ready | expired
            $table->string('path')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['store_id', 'created_at']);
        });

        // The existing activity_logs table (Phase 0) gets a human-readable line for the merchant-facing log.
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->string('summary', 255)->nullable()->after('action');
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->timestamp('deletion_requested_at')->nullable(); // owner asked to delete; shops are offline, 14-day grace
            $table->timestamp('purged_at')->nullable(); // data deleted; the row stays for invoice records
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn(['deletion_requested_at', 'purged_at']);
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropColumn('summary');
        });

        Schema::dropIfExists('data_exports');
        Schema::dropIfExists('legal_acceptances');
    }
};
