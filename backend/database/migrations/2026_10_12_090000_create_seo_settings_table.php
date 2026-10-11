<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per store holding the technical / site-wide SEO configuration
        // (robots.txt, sitemap, schema, search-engine verification, analytics, and
        // the homepage + blog landing page meta). Per-entity SEO stays in
        // seo_metadata; this is only for settings that belong to the site itself.
        Schema::create('seo_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->unique()->constrained()->cascadeOnDelete();
            $table->json('data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seo_settings');
    }
};
