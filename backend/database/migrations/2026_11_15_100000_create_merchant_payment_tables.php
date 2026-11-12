<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per store per payment provider. Credentials are the store's own and are encrypted.
        Schema::create('store_payment_gateways', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 30); // sslcommerz | stripe | fake
            $table->boolean('is_enabled')->default(false);
            $table->boolean('test_mode')->default(true);
            $table->text('credentials')->nullable(); // encrypted JSON
            $table->timestamps();

            $table->unique(['store_id', 'provider']);
        });

        // One row per time a shopper is sent to a payment page. The money is only real once a
        // provider-verified result for the right amount settles it.
        Schema::create('payment_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 30);
            $table->string('tran_id', 64)->unique();
            $table->bigInteger('amount_minor');
            $table->char('currency_code', 3)->default('BDT');
            $table->string('status', 16)->default('initiated'); // initiated | paid | failed | cancelled | mismatch
            $table->string('provider_reference')->nullable(); // the provider's own transaction id
            $table->bigInteger('refunded_minor')->default(0);
            $table->boolean('test_mode')->default(false);
            $table->string('return_url', 500)->nullable(); // the shop address the shopper came from
            $table->json('gateway_payload')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_attempts');
        Schema::dropIfExists('store_payment_gateways');
    }
};
