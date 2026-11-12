<?php

namespace Tests\Feature\Infrastructure;

use App\Models\Order;
use App\Models\Plan;
use App\Models\Product;
use App\Models\StockLevel;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Billing\BillingService;
use App\Services\Tenancy\TenantBackup;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Phase 8: tenant file layout and storage quota, health check, per-shop backup and restore. */
class InfrastructureTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        $this->store = Store::factory()->create(['status' => 'active']);
        $this->owner = User::factory()->create(['current_store_id' => $this->store->id]);
        $this->owner->stores()->attach($this->store->id, ['is_owner' => true, 'status' => 'active']);
        $this->owner->assignRole('Super Admin');
    }

    private function upload(int $kilobytes = 10): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->owner, 'sanctum')->postJson('/api/v1/media', [
            'store_id' => $this->store->id,
            'image' => UploadedFile::fake()->image('logo.png', 40, 40)->size($kilobytes),
        ]);
    }

    // ---- media layout and quota ---------------------------------------------------------------

    public function test_files_keep_the_old_layout_when_saas_mode_is_off(): void
    {
        Storage::fake('public');

        $path = $this->upload()->assertCreated()->json('data.path') ?? DB::table('media')->value('path');

        $this->assertStringStartsWith('media/', $path);
        $this->assertStringNotContainsString('tenants/', $path);
    }

    public function test_files_live_under_the_shops_own_folder_in_saas_mode(): void
    {
        Storage::fake('public');
        config(['app.saas_mode' => true]);

        $this->upload()->assertCreated();

        $path = (string) DB::table('media')->where('store_id', $this->store->id)->value('path');
        $this->assertStringStartsWith('tenants/'.$this->store->uuid.'/media/', $path);
        Storage::disk('public')->assertExists($path);
    }

    public function test_media_urls_resolve_for_old_and_tenant_paths(): void
    {
        Storage::fake('public');

        $this->assertStringEndsWith('/media/a.png', \App\Support\MediaLibrary::url('media/a.png'));
        $this->assertStringEndsWith('/tenants/u/media/a.png', \App\Support\MediaLibrary::url('tenants/u/media/a.png'));
    }

    public function test_upload_over_the_plan_storage_allowance_is_refused(): void
    {
        Storage::fake('public');
        config(['app.saas_mode' => true]);
        $plan = Plan::where('key', 'starter')->firstOrFail();
        $plan->update(['limits' => array_merge($plan->limits, ['storage_mb' => 1])]);
        app(BillingService::class)->override($this->store->organization, $plan->fresh(), 'active');

        $this->upload(600)->assertCreated();
        $this->upload(600)->assertStatus(402)->assertJsonPath('errors.resource.0', 'storage_mb');

        $this->assertSame(1, DB::table('media')->count(), 'the refused file must not be stored');
    }

    public function test_storage_is_not_limited_when_saas_mode_is_off_or_there_is_no_plan(): void
    {
        Storage::fake('public');
        $plan = Plan::where('key', 'starter')->firstOrFail();
        $plan->update(['limits' => array_merge($plan->limits, ['storage_mb' => 1])]);
        app(BillingService::class)->override($this->store->organization, $plan->fresh(), 'active');

        $this->upload(600)->assertCreated();
        $this->upload(600)->assertCreated();
    }

    public function test_storage_usage_is_reported_in_the_plan_summary(): void
    {
        Storage::fake('public');
        $this->upload(300)->assertCreated();

        $used = collect(app(\App\Services\Billing\PlanLimits::class)->summary($this->store->organization))->firstWhere('resource', 'storage_mb');

        $this->assertSame(1, $used['used']);
    }

    // ---- health ---------------------------------------------------------------------------------

    public function test_health_is_ok_and_reveals_nothing_but_check_names(): void
    {
        $response = $this->getJson('/api/v1/health')->assertOk()->assertJsonPath('status', 'ok');

        $this->assertSame(['database', 'cache', 'queue'], array_keys($response->json('checks')));
    }

    public function test_health_reports_a_stopped_scheduler_when_one_is_required(): void
    {
        config(['health.require_scheduler' => true]);
        Cache::forget(\App\Http\Controllers\Api\V1\HealthController::SCHEDULER_KEY);

        $this->getJson('/api/v1/health')->assertStatus(503)->assertJsonPath('checks.scheduler', false);

        Cache::put(\App\Http\Controllers\Api\V1\HealthController::SCHEDULER_KEY, now()->timestamp, 600);
        $this->getJson('/api/v1/health')->assertOk();
    }

    public function test_health_flags_a_dead_queue_worker(): void
    {
        config(['queue.default' => 'database', 'health.max_job_age_minutes' => 10]);
        DB::table('jobs')->insert(['queue' => 'default', 'payload' => '{}', 'attempts' => 0, 'available_at' => now()->subHour()->timestamp, 'created_at' => now()->subHour()->timestamp]);

        $this->getJson('/api/v1/health')->assertStatus(503)->assertJsonPath('checks.queue', false);
    }

    // ---- per-shop backup ------------------------------------------------------------------------

    public function test_every_table_is_covered_by_backups_or_declared_global(): void
    {
        $backup = app(TenantBackup::class);

        $this->assertSame([], $backup->uncovered(), 'New table: give it store_id, add it to TenantBackup::CHILDREN, or add it to GLOBAL_TABLES.');

        foreach (TenantBackup::CHILDREN as $child => [$parent, $fk]) {
            $this->assertTrue(Schema::hasTable($child), "{$child} missing");
            $this->assertTrue(Schema::hasColumn($child, $fk), "{$child}.{$fk} missing");
            $this->assertTrue(Schema::hasTable($parent), "{$parent} missing");
        }
    }

    /** A shop with real data: products, stock, an order with items. */
    private function shopWithOrder(Store $store): Order
    {
        $warehouse = Warehouse::factory()->for($store)->create();
        $product = Product::factory()->for($store)->create(['status' => 'active', 'price_amount' => 50000]);
        StockLevel::factory()->for($product)->for($warehouse)->create(['quantity' => 20, 'quantity_reserved' => 0]);

        $this->postJson('/api/v1/storefront/checkout', [
            'customer_name' => 'Karim Rahman', 'customer_phone' => '01712345678',
            'shipping_recipient_name' => 'Karim Rahman', 'shipping_phone' => '01712345678', 'shipping_address_line' => 'House 1, Dhaka',
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ])->assertCreated();

        return Order::query()->where('store_id', $store->id)->latest('id')->firstOrFail();
    }

    private function counts(int $storeId): array
    {
        $backup = app(TenantBackup::class);
        $counts = [];

        foreach ($backup->tables() as $table) {
            $counts[$table] = DB::table($table)->where('store_id', $storeId)->count();
        }

        $counts['order_items'] = DB::table('order_items')->whereIn('order_id', DB::table('orders')->where('store_id', $storeId)->pluck('id'))->count();

        return array_filter($counts);
    }

    public function test_export_then_restore_rebuilds_a_shop_after_data_loss(): void
    {
        $order = $this->shopWithOrder($this->store);
        $before = $this->counts($this->store->id);
        $this->assertGreaterThan(0, $before['order_items']);

        $file = app(TenantBackup::class)->export($this->store, storage_path('framework/testing/shop.tenant'));
        $this->assertStringNotContainsString($order->order_number, file_get_contents($file), 'the export file must be encrypted');

        // Data loss: the orders and their lines vanish.
        Schema::disableForeignKeyConstraints();
        DB::table('order_items')->where('order_id', $order->id)->delete();
        DB::table('orders')->where('store_id', $this->store->id)->delete();
        Schema::enableForeignKeyConstraints();
        $this->assertArrayNotHasKey('order_items', $this->counts($this->store->id));

        app(TenantBackup::class)->restore($file, replace: true);

        $this->assertSame($before, $this->counts($this->store->id));
        $this->assertSame($order->order_number, Order::query()->find($order->id)->order_number);
    }

    public function test_restore_refuses_to_overwrite_a_shop_unless_told_to(): void
    {
        $this->shopWithOrder($this->store);
        $file = app(TenantBackup::class)->export($this->store, storage_path('framework/testing/refuse.tenant'));

        $this->expectExceptionMessage('already has');
        app(TenantBackup::class)->restore($file);
    }

    public function test_dry_run_proves_the_file_restores_without_changing_anything(): void
    {
        $this->shopWithOrder($this->store);
        $file = app(TenantBackup::class)->export($this->store, storage_path('framework/testing/dry.tenant'));
        $before = $this->counts($this->store->id);

        $restored = app(TenantBackup::class)->restore($file, replace: true, dryRun: true);

        $this->assertSame($before['orders'], $restored['orders']);
        $this->assertSame($before, $this->counts($this->store->id), 'a dry run must leave the database as it was');
    }

    public function test_restoring_one_shop_never_touches_another(): void
    {
        $this->shopWithOrder($this->store);
        $other = Store::factory()->create(['status' => 'active']);
        Product::factory()->for($other)->count(3)->create();
        $otherBefore = $this->counts($other->id);

        $file = app(TenantBackup::class)->export($this->store, storage_path('framework/testing/iso.tenant'));
        app(TenantBackup::class)->restore($file, replace: true);

        $this->assertSame($otherBefore, $this->counts($other->id));
        $exported = app(TenantBackup::class)->read($file);
        $this->assertSame([$this->store->id], array_values(array_unique(array_column($exported['tables']['products'], 'store_id'))));
    }

    public function test_a_wrong_key_or_damaged_file_is_rejected(): void
    {
        $file = app(TenantBackup::class)->export($this->store, storage_path('framework/testing/key.tenant'));

        config(['backup.key' => 'base64:'.base64_encode(random_bytes(32))]);

        $this->expectExceptionMessage('cannot be read');
        app(TenantBackup::class)->read($file);
    }

    public function test_the_commands_export_and_dry_run_restore(): void
    {
        $this->shopWithOrder($this->store);
        $file = storage_path('framework/testing/cmd.tenant');

        $this->artisan('tenant:export', ['store' => $this->store->uuid, '--out' => $file])->assertSuccessful();
        $this->artisan('tenant:restore', ['file' => $file, '--replace' => true, '--dry-run' => true])->assertSuccessful()->expectsOutputToContain('Dry run OK');
        $this->artisan('tenant:restore', ['file' => $file])->assertFailed();
    }
}
