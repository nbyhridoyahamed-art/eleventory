<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Store membership now decides who may act for a store (multi-tenant
     * mode), but nothing used to write store_user rows. Give every staff
     * user without a membership one in their current store, or the first
     * store, so switching SAAS_MODE on locks nobody out of their own shop.
     */
    public function up(): void
    {
        $firstStoreId = DB::table('stores')->orderBy('id')->value('id');

        if ($firstStoreId === null) {
            return;
        }

        DB::table('users')->orderBy('id')->each(function ($user) use ($firstStoreId) {
            if (DB::table('store_user')->where('user_id', $user->id)->exists()) {
                return;
            }

            $storeId = $user->current_store_id && DB::table('stores')->where('id', $user->current_store_id)->exists()
                ? $user->current_store_id
                : $firstStoreId;

            DB::table('store_user')->insert([
                'store_id' => $storeId,
                'user_id' => $user->id,
                'is_owner' => false,
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        // Memberships are data, not structure; nothing to undo.
    }
};
