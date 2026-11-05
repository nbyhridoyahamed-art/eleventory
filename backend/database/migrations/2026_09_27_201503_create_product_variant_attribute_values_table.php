<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_variant_attribute_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_variant_id')->constrained('product_variants')->cascadeOnDelete();
            $table->foreignId('product_attribute_value_id')->constrained('product_attribute_values', indexName: 'pvav_attribute_value_foreign')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['product_variant_id', 'product_attribute_value_id'], 'pvav_variant_value_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_variant_attribute_values');
    }
};
