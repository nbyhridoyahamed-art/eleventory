<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 9: one theme per store, kept as a draft and a published copy so changes can be previewed
 * before visitors see them. `custom_css` becomes a plan feature (Growth and up).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_themes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->unique()->constrained()->cascadeOnDelete();
            $table->json('draft');
            $table->json('published')->nullable(); // null = the standard look
            $table->string('preview_token', 40); // unlisted link secret for previewing the draft; rotated on publish
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        foreach (['starter' => false, 'growth' => true, 'pro' => true, 'legacy' => true] as $key => $allowed) {
            $plan = DB::table('plans')->where('key', $key)->first();

            if ($plan) {
                $features = json_decode($plan->features, true) ?: [];
                $features['custom_css'] = $allowed;
                DB::table('plans')->where('id', $plan->id)->update(['features' => json_encode($features)]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('store_themes');

        foreach (DB::table('plans')->get() as $plan) {
            $features = json_decode($plan->features, true) ?: [];
            unset($features['custom_css']);
            DB::table('plans')->where('id', $plan->id)->update(['features' => json_encode($features)]);
        }
    }
};
