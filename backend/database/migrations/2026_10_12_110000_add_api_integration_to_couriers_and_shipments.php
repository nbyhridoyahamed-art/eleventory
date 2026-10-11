<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('couriers', function (Blueprint $table) {
            // 'manual' = staff type the tracking number; 'steadfast' = booked through the API.
            $table->string('provider', 30)->default('manual')->after('name');
            $table->text('api_key')->nullable()->after('provider');
            $table->text('api_secret')->nullable()->after('api_key');
        });

        Schema::table('shipments', function (Blueprint $table) {
            $table->string('external_id', 100)->nullable()->after('tracking_number');
            $table->string('courier_status', 60)->nullable()->after('external_id');
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn(['external_id', 'courier_status']);
        });

        Schema::table('couriers', function (Blueprint $table) {
            $table->dropColumn(['provider', 'api_key', 'api_secret']);
        });
    }
};
