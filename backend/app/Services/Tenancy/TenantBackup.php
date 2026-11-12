<?php

namespace App\Services\Tenancy;

use App\Models\Store;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

/**
 * One shop's data as a single encrypted file, and the way back.
 *
 * This is the per-tenant half of backups (a whole-database dump is deploy/vps/backup.sh): it lets
 * the platform hand a merchant their data, rebuild one shop after a bad import or deletion, and
 * prove on a schedule that a backup can really be read and restored (`tenant:restore --dry-run`).
 *
 * What is in a file: every row of every table that carries store_id, plus the child tables that
 * belong to a shop only through a parent row (order_items via orders, ...). The map of those
 * children is below and MUST grow with the schema: TenantBackupTest fails when a table is neither
 * covered nor declared global, so a new table cannot silently be left out of backups.
 *
 * Not in a file: uploaded media (listed by path in the manifest; they live on the media disk, which
 * is backed up as files), the owner's user accounts, and the plan/subscription (account-level).
 * Encrypted columns stay encrypted with APP_KEY, so keep APP_KEY with the backups' keys.
 */
class TenantBackup
{
    public const FORMAT = 1;

    /** Child table => [parent table, column in the child that holds the parent's id]. Order matters for restore readability only. */
    public const CHILDREN = [
        'order_items' => ['orders', 'order_id'],
        'order_item_components' => ['order_items', 'order_item_id'],
        'order_status_history' => ['orders', 'order_id'],
        'product_images' => ['products', 'product_id'],
        'product_attribute_values' => ['product_attributes', 'product_attribute_id'],
        'product_variant_attribute_values' => ['product_variants', 'product_variant_id'],
        'bundle_items' => ['products', 'bundle_product_id'],
        'blog_post_tag' => ['blog_posts', 'blog_post_id'],
        'coupon_usages' => ['coupons', 'coupon_id'],
        'customer_addresses' => ['customers', 'customer_id'],
        'delivery_zone_rates' => ['delivery_zones', 'delivery_zone_id'],
        'return_items' => ['returns', 'return_id'],
        'return_status_history' => ['returns', 'return_id'],
        'purchase_order_items' => ['purchase_orders', 'purchase_order_id'],
        'purchase_order_status_history' => ['purchase_orders', 'purchase_order_id'],
        'purchase_receipt_items' => ['purchase_receipts', 'purchase_receipt_id'],
        'purchase_return_items' => ['purchase_returns', 'purchase_return_id'],
        'purchase_return_status_history' => ['purchase_returns', 'purchase_return_id'],
        'shipment_status_history' => ['shipments', 'shipment_id'],
        'stock_levels' => ['warehouses', 'warehouse_id'],
        'stock_transfer_items' => ['stock_transfers', 'stock_transfer_id'],
        'stock_transfer_status_history' => ['stock_transfers', 'stock_transfer_id'],
        'cod_settlement_shipments' => ['cod_settlements', 'cod_settlement_id'],
    ];

    /** Tables that are the platform's, or framework plumbing, not any one shop's data. */
    public const GLOBAL_TABLES = [
        'migrations', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'sessions',
        'password_reset_tokens', 'personal_access_tokens', 'notifications',
        'users', 'stores', 'organizations', 'plans', 'subscriptions', 'invoices', 'announcements',
        'roles', 'permissions', 'role_has_permissions', 'model_has_roles', 'model_has_permissions',
        'currencies', 'bd_divisions', 'bd_districts', 'bd_upazilas',
        'legal_acceptances', // about people, not shops: kept as proof of what each person accepted
    ];

    /**
     * Platform-side records ABOUT a shop (support notes, audit trail, abuse reports). They carry a store_id
     * but are the platform's, so they are never in a shop's export or backup and never restored or wiped
     * with it (deleting the shop row nulls or cascades them by their own foreign keys).
     */
    public const PLATFORM_OWNED = ['platform_audit_logs', 'abuse_reports', 'tenant_notes'];

    /** Tables to read and write, direct ones first, each with how to select a shop's rows. */
    public function tables(): array
    {
        $tables = [];

        foreach ($this->allTables() as $table) {
            if (in_array($table, self::GLOBAL_TABLES, true) || in_array($table, self::PLATFORM_OWNED, true) || isset(self::CHILDREN[$table])) {
                continue;
            }

            if (Schema::hasColumn($table, 'store_id')) {
                $tables[] = $table;
            }
        }

        return $tables;
    }

    /** Tables that are in none of the three groups; the test fails if this is not empty. @return string[] */
    public function uncovered(): array
    {
        return array_values(array_filter($this->allTables(), fn (string $table) => ! in_array($table, self::GLOBAL_TABLES, true)
            && ! isset(self::CHILDREN[$table])
            && ! Schema::hasColumn($table, 'store_id')));
    }

    /** Writes the encrypted export and returns its path. */
    public function export(Store $store, ?string $path = null): string
    {
        $payload = ['format' => self::FORMAT, 'exported_at' => now()->toIso8601String(), 'store' => (array) DB::table('stores')->find($store->id), 'tables' => []];

        foreach ($this->tables() as $table) {
            $payload['tables'][$table] = DB::table($table)->where('store_id', $store->id)->orderBy($this->key($table))->get()->map(fn ($row) => (array) $row)->all();
        }

        foreach (self::CHILDREN as $child => [$parent, $fk]) {
            if (! Schema::hasTable($child)) {
                continue;
            }

            $payload['tables'][$child] = DB::table($child)->whereIn($fk, $this->parentIds($payload['tables'], $parent))->orderBy($this->key($child))->get()->map(fn ($row) => (array) $row)->all();
        }

        $payload['media'] = collect($payload['tables']['media'] ?? [])->map(fn ($m) => ['disk' => $m['disk'], 'path' => $m['path'], 'size' => $m['size']])->all();
        $payload['counts'] = array_map('count', $payload['tables']);

        $path ??= storage_path('app/backups/tenants/'.$store->uuid.'-'.now()->format('Ymd-His').'.tenant');
        @mkdir(dirname($path), 0700, true);
        file_put_contents($path, $this->encrypter()->encryptString(base64_encode(gzencode(json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), 9))));

        return $path;
    }

    /** Decrypts and validates a file without touching the database. */
    public function read(string $path): array
    {
        if (! is_file($path)) {
            throw new RuntimeException("Backup file not found: {$path}");
        }

        try {
            $json = gzdecode(base64_decode($this->encrypter()->decryptString(file_get_contents($path)), true) ?: '');
            $payload = json_decode((string) $json, true, flags: JSON_THROW_ON_ERROR);
        } catch (\Throwable $e) {
            throw new RuntimeException('This backup cannot be read (wrong key, damaged or not a tenant export).', 0, $e);
        }

        if (($payload['format'] ?? null) !== self::FORMAT || ! isset($payload['store']['id'], $payload['tables'])) {
            throw new RuntimeException('This file is not a supported tenant export.');
        }

        foreach ($payload['counts'] ?? [] as $table => $count) {
            if (count($payload['tables'][$table] ?? []) !== $count) {
                throw new RuntimeException("Backup is damaged: table {$table} does not match its recorded row count.");
            }
        }

        return $payload;
    }

    /**
     * Put the shop back. Refuses when the shop already has data unless $replace (then its rows are
     * deleted first). All or nothing: any error leaves the database as it was. $dryRun does the
     * whole restore and rolls it back, proving the file really restores.
     *
     * @return array<string, int> rows restored per table
     */
    public function restore(string $path, bool $replace = false, bool $dryRun = false): array
    {
        $payload = $this->read($path);
        $storeId = (int) $payload['store']['id'];
        $existing = collect($this->tables())->sum(fn (string $t) => DB::table($t)->where('store_id', $storeId)->count());

        if ($existing > 0 && ! $replace) {
            throw new RuntimeException("Store {$storeId} already has {$existing} rows. Use --replace to overwrite it.");
        }

        $restored = [];

        Schema::disableForeignKeyConstraints();

        try {
            DB::beginTransaction();

            // SQLite ignores "foreign keys off" inside a transaction; defer the checks instead.
            if (DB::connection()->getDriverName() === 'sqlite') {
                DB::statement('PRAGMA defer_foreign_keys = ON');
            }

            if ($existing > 0) {
                $this->wipe($storeId);
            }

            if (! DB::table('stores')->where('id', $storeId)->exists()) {
                DB::table('stores')->insert($payload['store']);
            }

            foreach ($payload['tables'] as $table => $rows) {
                foreach (array_chunk($rows, 200) as $chunk) {
                    DB::table($table)->insert($chunk);
                }

                $restored[$table] = count($rows);
            }

            $dryRun ? DB::rollBack() : DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        return $restored;
    }

    /**
     * One shop's rows in $table (a direct table, or a child reached through its parents), as a query.
     * Used by the shop export and by the data export for merchants.
     */
    public function rows(string $table, int $storeId): \Illuminate\Database\Query\Builder
    {
        if (! isset(self::CHILDREN[$table])) {
            return DB::table($table)->where('store_id', $storeId);
        }

        [$parent, $fk] = self::CHILDREN[$table];

        return DB::table($table)->whereIn($fk, $this->rows($parent, $storeId)->select('id'));
    }

    /** Every table a shop's data lives in: direct tables, then children. @return string[] */
    public function allShopTables(): array
    {
        return array_values(array_merge($this->tables(), array_filter(array_keys(self::CHILDREN), fn ($t) => Schema::hasTable($t))));
    }

    /**
     * Delete every row of the shop's data (not the shop row itself). The caller owns the transaction and
     * foreign-key switch, as restore() and the account purge both do.
     */
    public function wipeStore(int $storeId): void
    {
        $this->wipe($storeId);
    }

    private function wipe(int $storeId): void
    {
        // Work out which child rows belong to the shop first (parents before children), then delete
        // children before parents.
        $parents = array_unique(array_column(self::CHILDREN, 0));
        $current = [];

        foreach ($this->tables() as $table) {
            if (in_array($table, $parents, true)) {
                $current[$table] = DB::table($table)->where('store_id', $storeId)->pluck('id')->map(fn ($id) => ['id' => $id])->all();
            }
        }

        // For each child: the parent ids it hangs off, and (when it is itself a parent) its own ids.
        $plan = [];

        foreach (self::CHILDREN as $child => [$parent, $fk]) {
            if (! Schema::hasTable($child)) {
                continue;
            }

            $parentIds = $this->parentIds($current, $parent);
            $plan[$child] = [$fk, $parentIds];

            // Pivot tables (blog_post_tag, ...) have no id column and nothing hangs off them.
            if (in_array($child, $parents, true)) {
                $current[$child] = DB::table($child)->whereIn($fk, $parentIds)->pluck('id')->map(fn ($id) => ['id' => $id])->all();
            }
        }

        foreach (array_reverse($plan, true) as $child => [$fk, $parentIds]) {
            foreach (array_chunk($parentIds, 500) as $chunk) {
                DB::table($child)->whereIn($fk, $chunk)->delete();
            }
        }

        foreach ($this->tables() as $table) {
            DB::table($table)->where('store_id', $storeId)->delete();
        }
    }

    /** Ids of a parent table's rows, whether it is a direct table or itself a child already read. */
    private function parentIds(array $tables, string $parent): array
    {
        return array_column($tables[$parent] ?? [], 'id');
    }

    private function key(string $table): string
    {
        return Schema::hasColumn($table, 'id') ? 'id' : (Schema::getColumnListing($table)[0] ?? 'id');
    }

    /** @return string[] */
    private function allTables(): array
    {
        return array_map(fn ($t) => $t['name'], Schema::getTables());
    }

    private function encrypter(): Encrypter
    {
        $key = (string) (config('backup.key') ?: config('app.key'));
        $key = str_starts_with($key, 'base64:') ? base64_decode(substr($key, 7)) : $key;

        return new Encrypter($key, config('app.cipher'));
    }
}
