<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('domain', 253);
            // pending = waiting for DNS, active = ownership verified and served, failed = last check found a problem.
            $table->string('status', 16)->default('pending');
            $table->string('verification_token', 48);
            // Equals `domain` only while active. Unique, so one active owner per domain while any
            // number of stores may hold a pending claim (a squatter cannot block the real owner).
            $table->string('active_domain', 253)->nullable()->unique();
            $table->boolean('is_primary')->default(false);
            // Whether the domain pointed at our servers at the last check (informational).
            $table->boolean('points_here')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->string('last_error')->nullable();
            $table->timestamps();

            $table->index('domain');
            $table->index(['store_id', 'status']);
        });

        // Domains already saved on a store (stores.domain, e.g. the live shop) become its
        // verified primary domain, so nothing that works today stops working.
        DB::table('stores')->whereNotNull('domain')->orderBy('id')->each(function ($store) {
            $domain = strtolower(trim($store->domain));

            if ($domain === '') {
                return;
            }

            DB::table('store_domains')->insert([
                'store_id' => $store->id,
                'domain' => $domain,
                'status' => 'active',
                'verification_token' => Str::random(40),
                'active_domain' => $domain,
                'is_primary' => true,
                'verified_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_domains');
    }
};
