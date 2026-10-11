<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The 0–100 on-page SEO score from SeoAnalyzer, stored when an item's SEO
        // is saved or generated so lists and the dashboard can read it without
        // re-analysing every row.
        Schema::table('seo_metadata', function (Blueprint $table) {
            $table->unsignedTinyInteger('score')->nullable()->after('schema_json')->index();
        });

        // 404 Monitor: one row per missing path, with a hit counter.
        Schema::create('not_found_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('path', 500);
            $table->string('path_hash', 40);
            $table->unsignedInteger('hits')->default(1);
            $table->string('last_referrer', 500)->nullable();
            $table->string('last_user_agent', 255)->nullable();
            $table->timestamp('first_seen_at')->useCurrent();
            $table->timestamp('last_seen_at')->useCurrent();
            $table->timestamps();

            $table->unique(['store_id', 'path_hash']);
            $table->index(['store_id', 'hits']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('not_found_logs');

        Schema::table('seo_metadata', function (Blueprint $table) {
            $table->dropColumn('score');
        });
    }
};
