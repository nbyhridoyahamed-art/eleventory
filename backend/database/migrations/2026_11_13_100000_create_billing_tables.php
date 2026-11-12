<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('key', 40)->unique();
            $table->string('name', 80);
            $table->string('description')->nullable();
            $table->decimal('price_monthly', 12, 2)->default(0);
            $table->decimal('price_yearly', 12, 2)->nullable();
            $table->string('currency', 3)->default('BDT');
            // {"products": 100, "staff": 3, "orders_per_month": 500, "custom_domains": 1}; a missing or null key = unlimited.
            $table->json('limits');
            // {"online_payments": false, ...}
            $table->json('features');
            $table->boolean('is_public')->default(true);   // shown on the pricing page and chooseable
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            // One subscription per account (organization); its stores share the plan.
            $table->foreignId('organization_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('plans');
            // A downgrade chosen mid-period takes effect when the period ends.
            $table->foreignId('pending_plan_id')->nullable()->constrained('plans')->nullOnDelete();
            // trialing -> active -> past_due -> suspended -> cancelled
            $table->string('status', 16)->default('trialing');
            $table->string('billing_cycle', 8)->default('monthly');
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('current_period_start')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->timestamp('grace_ends_at')->nullable();
            $table->boolean('cancel_at_period_end')->default(false);
            $table->timestamp('cancelled_at')->nullable();
            $table->string('gateway', 24)->nullable();
            $table->timestamps();

            $table->index(['status', 'current_period_end']);
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('plan_id')->nullable()->constrained('plans')->nullOnDelete();
            $table->string('number', 32)->unique();
            $table->string('status', 12)->default('open'); // open | paid | void | failed
            $table->string('billing_cycle', 8)->default('monthly');
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3)->default('BDT');
            $table->string('description')->nullable();
            $table->timestamp('period_start')->nullable();
            $table->timestamp('period_end')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('gateway', 24)->nullable();
            $table->string('tran_id', 64)->nullable()->unique(); // our reference sent to the gateway
            $table->json('gateway_payload')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'status']);
        });

        // Why a store is offline, so paying an invoice only reopens shops that billing closed.
        Schema::table('stores', function (Blueprint $table) {
            $table->string('suspension_reason', 16)->nullable()->after('status'); // billing | platform
        });

        $this->seedPlans();
        $this->backfillSubscriptions();
    }

    /**
     * Starting prices are PLACEHOLDERS to be edited (platform plan editor, Phase 6); nothing
     * charges anyone until a payment gateway is configured. `legacy` is never shown or sold:
     * it carries accounts that predate billing, unlimited and free.
     */
    private function seedPlans(): void
    {
        $now = now();
        $plans = [
            ['starter', 'Starter', 'For a new shop getting its first orders.', 999, 9990,
                ['products' => 100, 'staff' => 3, 'orders_per_month' => 500, 'custom_domains' => 1],
                ['online_payments' => false], true, 10],
            ['growth', 'Growth', 'For a busy shop that takes online payments.', 2499, 24990,
                ['products' => 1000, 'staff' => 10, 'orders_per_month' => 5000, 'custom_domains' => 3],
                ['online_payments' => true], true, 20],
            ['pro', 'Pro', 'For large catalogues and bigger teams.', 5999, 59990,
                ['products' => null, 'staff' => 30, 'orders_per_month' => null, 'custom_domains' => 10],
                ['online_payments' => true], true, 30],
            ['legacy', 'Founding store', 'Accounts that predate paid plans.', 0, null,
                ['products' => null, 'staff' => null, 'orders_per_month' => null, 'custom_domains' => null],
                ['online_payments' => true], false, 99],
        ];

        foreach ($plans as [$key, $name, $description, $monthly, $yearly, $limits, $features, $public, $order]) {
            DB::table('plans')->insert([
                'key' => $key, 'name' => $name, 'description' => $description,
                'price_monthly' => $monthly, 'price_yearly' => $yearly, 'currency' => 'BDT',
                'limits' => json_encode($limits), 'features' => json_encode($features),
                'is_public' => $public, 'is_active' => true, 'sort_order' => $order,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    /** Trials keep their trial (on Growth's limits); everyone else keeps working, unlimited. */
    private function backfillSubscriptions(): void
    {
        $growth = DB::table('plans')->where('key', 'growth')->value('id');
        $legacy = DB::table('plans')->where('key', 'legacy')->value('id');

        DB::table('organizations')->orderBy('id')->each(function ($org) use ($growth, $legacy) {
            $trial = $org->plan === 'trial';

            DB::table('subscriptions')->insert([
                'organization_id' => $org->id,
                'plan_id' => $trial ? $growth : $legacy,
                'status' => $trial ? 'trialing' : 'active',
                'billing_cycle' => 'monthly',
                'trial_ends_at' => $trial ? $org->trial_ends_at : null,
                'current_period_start' => $trial ? null : now(),
                'current_period_end' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('suspension_reason');
        });
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('plans');
    }
};
