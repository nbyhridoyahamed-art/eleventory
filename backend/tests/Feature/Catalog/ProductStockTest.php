<?php

namespace Tests\Feature\Catalog;

use App\Models\Product;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductStockTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    private function admin(): User
    {
        $user = User::factory()->create();
        $user->assignRole('Super Admin');

        return $user;
    }

    private function payload(Store $store, array $overrides = []): array
    {
        return $overrides + ['store_id' => $store->id, 'name' => 'Stocked', 'slug' => 'stocked-'.uniqid(), 'price' => '100'];
    }

    public function test_opening_stock_is_written_through_the_inventory_ledger(): void
    {
        $store = Store::factory()->create();
        $warehouse = Warehouse::factory()->for($store)->create();

        $response = $this->actingAs($this->admin(), 'sanctum')
            ->postJson('/api/v1/products', $this->payload($store, ['stock' => ['warehouse_id' => $warehouse->id, 'quantity' => 25]]))
            ->assertCreated()
            ->assertJsonPath('data.stock.total', 25)
            ->assertJsonPath('data.stock.levels.0.warehouse_id', $warehouse->id);

        $productId = $response->json('data.id');
        $this->assertSame(25, StockLevel::where('product_id', $productId)->value('quantity'));

        $movement = StockMovement::where('product_id', $productId)->firstOrFail();
        $this->assertSame('adjustment_increase', $movement->type);
        $this->assertSame(25, $movement->quantity);
    }

    public function test_editing_the_stock_writes_only_the_difference(): void
    {
        $store = Store::factory()->create();
        $warehouse = Warehouse::factory()->for($store)->create();
        $admin = $this->admin();

        $id = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/products', $this->payload($store, ['stock' => ['warehouse_id' => $warehouse->id, 'quantity' => 10]]))
            ->json('data.id');

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/products/{$id}", $this->payload($store, ['stock' => ['warehouse_id' => $warehouse->id, 'quantity' => 4]]))
            ->assertOk()->assertJsonPath('data.stock.total', 4);

        $decrease = StockMovement::where('product_id', $id)->where('type', 'adjustment_decrease')->firstOrFail();
        $this->assertSame(6, $decrease->quantity);

        // Same quantity again: no new ledger row.
        $before = StockMovement::where('product_id', $id)->count();
        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/products/{$id}", $this->payload($store, ['stock' => ['warehouse_id' => $warehouse->id, 'quantity' => 4]]))
            ->assertOk();
        $this->assertSame($before, StockMovement::where('product_id', $id)->count());
    }

    public function test_stock_cannot_go_below_what_is_reserved_and_nothing_is_saved(): void
    {
        $store = Store::factory()->create();
        $warehouse = Warehouse::factory()->for($store)->create();
        $admin = $this->admin();

        $id = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/products', $this->payload($store, ['name' => 'Original', 'stock' => ['warehouse_id' => $warehouse->id, 'quantity' => 10]]))
            ->json('data.id');
        StockLevel::where('product_id', $id)->update(['quantity_reserved' => 8]);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/products/{$id}", $this->payload($store, ['name' => 'Renamed', 'stock' => ['warehouse_id' => $warehouse->id, 'quantity' => 2]]))
            ->assertStatus(422);

        $this->assertSame('Original', Product::find($id)->name);
        $this->assertSame(10, StockLevel::where('product_id', $id)->value('quantity'));
    }

    public function test_warehouse_must_belong_to_the_store(): void
    {
        $store = Store::factory()->create();
        $other = Warehouse::factory()->for(Store::factory()->create())->create();

        $this->actingAs($this->admin(), 'sanctum')
            ->postJson('/api/v1/products', $this->payload($store, ['stock' => ['warehouse_id' => $other->id, 'quantity' => 5]]))
            ->assertStatus(422);
    }
}
