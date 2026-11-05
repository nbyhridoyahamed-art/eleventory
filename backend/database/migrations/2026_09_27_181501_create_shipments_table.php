<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('store_id')->constrained('stores')->cascadeOnDelete();
            // One shipment per order in Wave 1 — an order that needs re-dispatching
            // after a failed delivery is a Wave 2 problem (multi-shipment orders).
            $table->foreignId('order_id')->unique()->constrained('orders')->cascadeOnDelete();
            $table->foreignId('courier_id')->nullable()->constrained('couriers')->nullOnDelete();
            $table->string('tracking_number');
            // pending_pickup -> picked_up -> in_transit -> delivered, or
            // failed_delivery/returned_to_seller from picked_up/in_transit.
            $table->string('status')->default('pending_pickup');
            // A snapshot, independent of orders.shipping_amount — the courier's
            // actual charge can differ from what the customer was quoted.
            $table->bigInteger('delivery_charge_amount')->default(0);
            // Set only once status becomes 'delivered'; null until then even for
            // a COD order — collection happens at the doorstep, not at dispatch.
            $table->bigInteger('cod_amount_collected')->nullable();
            $table->boolean('cod_settled')->default(false);
            $table->timestamp('delivered_at')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['store_id', 'status']);
            $table->index('courier_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipments');
    }
};
