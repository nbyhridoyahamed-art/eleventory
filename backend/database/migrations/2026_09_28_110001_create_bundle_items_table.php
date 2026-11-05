<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bundle_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_product_id')->constrained('products')->cascadeOnDelete();

            // restrictOnDelete, not cascade — this defines what the bundle
            // currently consists of, not a historical/audit record, so a
            // product actively used as a component must be guarded against
            // deletion rather than silently vanishing from the bundle (same
            // reasoning as stock_levels.product_variant_id).
            $table->foreignId('component_product_id')->constrained('products')->restrictOnDelete();
            $table->foreignId('component_variant_id')->nullable()->constrained('product_variants')->restrictOnDelete();

            // How many units of the component one unit of the bundle needs.
            $table->unsignedInteger('quantity')->default(1);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            // A backstop, not the real guard — MySQL/SQLite both treat each
            // NULL as distinct, so this alone can't stop two NULL-variant
            // rows for the same bundle+component; the FormRequest's own
            // duplicate check is what actually prevents that (same caveat
            // already documented on stock_levels' own unique index).
            $table->unique(['bundle_product_id', 'component_product_id', 'component_variant_id'], 'bundle_items_component_unique');
            $table->index('component_product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bundle_items');
    }
};
