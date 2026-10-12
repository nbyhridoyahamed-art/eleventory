<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Staff users created from the Users screen had no current store, so every
     * store-scoped admin page was empty for them. Give each one the store they
     * belong to (or the first store).
     */
    public function up(): void
    {
        $firstStoreId = DB::table('stores')->orderBy('id')->value('id');

        if ($firstStoreId === null) {
            return;
        }

        $users = DB::table('users')->whereNull('current_store_id')->pluck('id');

        foreach ($users as $userId) {
            $storeId = DB::table('store_user')->where('user_id', $userId)->orderBy('store_id')->value('store_id') ?? $firstStoreId;

            DB::table('users')->where('id', $userId)->update(['current_store_id' => $storeId]);
        }
    }

    public function down(): void
    {
        // Not reversible: the previous (null) state carried no information.
    }
};
