<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_zone_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_zone_id')->constrained('delivery_zones')->cascadeOnDelete();
            // The order-subtotal threshold this tier applies from — every zone
            // must have exactly one tier at 0 (DeliveryZoneRequest enforces
            // this), so a zone always has a rate for any order value; a
            // further tier above 0 is how "free shipping over X" is expressed
            // (rate_amount 0 on that tier).
            $table->bigInteger('min_order_subtotal_amount')->default(0);
            $table->bigInteger('rate_amount');
            $table->string('currency_code', 3)->default('BDT');
            $table->timestamps();

            $table->unique(['delivery_zone_id', 'min_order_subtotal_amount'], 'delivery_zone_rates_tier_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_zone_rates');
    }
};
