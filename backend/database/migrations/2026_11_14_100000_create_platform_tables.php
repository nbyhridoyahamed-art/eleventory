<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Every sensitive thing a platform admin does, and every time one enters a shop they do not belong to.
        Schema::create('platform_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('store_id')->nullable()->constrained('stores')->nullOnDelete();
            $table->string('action', 80)->index();
            $table->json('meta')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('body');
            $table->string('level', 12)->default('info'); // info | warning | critical
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('abuse_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->nullable()->constrained('stores')->nullOnDelete();
            $table->string('url', 500)->nullable();
            $table->string('reason', 40); // spam | fraud | illegal | counterfeit | other
            $table->text('details')->nullable();
            $table->string('reporter_email')->nullable();
            $table->string('status', 12)->default('open')->index(); // open | actioned | dismissed
            $table->text('resolution_note')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('tenant_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained('stores')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('body');
            $table->timestamps();
        });

        // Per-account overrides on top of the plan: {"limits": {"products": 500}, "features": {"online_payments": true}}.
        Schema::table('organizations', function (Blueprint $table) {
            $table->json('feature_overrides')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('organizations', fn (Blueprint $table) => $table->dropColumn('feature_overrides'));
        Schema::dropIfExists('tenant_notes');
        Schema::dropIfExists('abuse_reports');
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('platform_audit_logs');
    }
};
