<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_levels', function (Blueprint $table) {
            // restrictOnDelete, not nullOnDelete/cascade — this is the current-state
            // row, not an audit entry, so a variant with any stock on hand must be
            // guarded against deletion (see ProductVariantController::destroy())
            // rather than silently losing or misattributing its count.
            $table->foreignId('product_variant_id')->nullable()->after('product_id')
                ->constrained('product_variants')->restrictOnDelete();

            // NULL product_variant_id means "the simple product itself." MySQL/SQLite
            // both treat each NULL as distinct in a unique index, so this alone can't
            // stop two NULL-variant rows for the same product+warehouse — every write
            // path already reads-then-writes under lockForUpdate() keyed on the same
            // triple (including the NULL case, since Eloquent's where($col, null)
            // compiles to IS NULL), so that discipline is the real guarantee; this
            // index is a backstop for the has-a-variant case and for catching bugs.
            $table->unique(['product_id', 'product_variant_id', 'warehouse_id']);

            // Dropped last: MySQL refuses to drop the old index while it is the only
            // one backing the product_id foreign key, so the new one goes in first.
            $table->dropUnique(['product_id', 'warehouse_id']);
        });
    }

    public function down(): void
    {
        Schema::table('stock_levels', function (Blueprint $table) {
            $table->dropUnique(['product_id', 'product_variant_id', 'warehouse_id']);
            $table->dropConstrainedForeignId('product_variant_id');
            $table->unique(['product_id', 'warehouse_id']);
        });
    }
};
