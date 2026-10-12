<?php

namespace Tests\Feature\Reports;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\StockLevel;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportInsightsTest extends TestCase
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

    public function test_sales_insights_break_revenue_down(): void
    {
        $store = Store::factory()->create();
        $warehouse = Warehouse::factory()->for($store)->create();
        $category = Category::factory()->for($store)->create(['name' => 'Audio']);
        $product = Product::factory()->for($store)->create(['category_id' => $category->id]);
        $newBuyer = Customer::factory()->for($store)->create(['name' => 'Newbie']);
        $oldBuyer = Customer::factory()->for($store)->create(['name' => 'Regular']);

        $order = function (Customer $c, string $at, int $minor, string $status = 'delivered') use ($store, $warehouse, $product) {
            $o = Order::factory()->for($store)->for($c)->for($warehouse)->create([
                'status' => $status, 'created_at' => $at, 'shipping_amount' => 5000, 'discount_amount' => 1000,
            ]);
            $o->items()->create(['product_id' => $product->id, 'quantity' => 1, 'unit_price_amount' => $minor]);
        };

        $order($oldBuyer, '2026-05-10 10:00:00', 10000);   // before the range -> makes "Regular" returning
        $order($oldBuyer, '2026-06-10 10:00:00', 30000);   // Wed
        $order($newBuyer, '2026-06-11 10:00:00', 20000);   // Thu
        $order($newBuyer, '2026-06-12 10:00:00', 99999, 'cancelled');

        $data = $this->actingAs($this->admin(), 'sanctum')
            ->getJson("/api/v1/reports/sales/insights?store_id={$store->id}&date_from=2026-06-01&date_to=2026-06-30")
            ->assertOk()->json('data');

        $this->assertSame('Audio', $data['by_category'][0]['name']);
        $this->assertEquals(500.0, $data['by_category'][0]['revenue_amount']);
        $this->assertSame('Regular', $data['top_customers'][0]['name']);
        $this->assertEquals(2, $data['summary']['buyers']);
        $this->assertEquals(1, $data['summary']['returning_buyers']);
        $this->assertEquals(1, $data['summary']['new_buyers']);
        $this->assertEquals(100.0, $data['summary']['shipping_collected']);
        $this->assertEquals(20.0, $data['summary']['discounts_given']);
        $this->assertEquals(300.0, $data['summary']['best_day']['revenue_amount']);
        $this->assertEquals(33.3, $data['summary']['cancellation_rate']);
        $this->assertCount(7, $data['by_weekday']);
    }

    public function test_stock_overview_counts_health_and_value(): void
    {
        $store = Store::factory()->create();
        $warehouse = Warehouse::factory()->for($store)->create();

        $healthy = Product::factory()->for($store)->create(['track_stock' => true, 'low_stock_threshold' => 5, 'price_amount' => 10000, 'cost_price_amount' => 6000, 'type' => 'simple']);
        $low = Product::factory()->for($store)->create(['track_stock' => true, 'low_stock_threshold' => 5, 'price_amount' => 1000, 'cost_price_amount' => 500, 'type' => 'simple']);
        Product::factory()->for($store)->create(['track_stock' => true, 'low_stock_threshold' => 5, 'type' => 'simple']); // no stock rows -> out

        StockLevel::create(['product_id' => $healthy->id, 'warehouse_id' => $warehouse->id, 'quantity' => 10, 'quantity_reserved' => 0]);
        StockLevel::create(['product_id' => $low->id, 'warehouse_id' => $warehouse->id, 'quantity' => 3, 'quantity_reserved' => 0]);

        $data = $this->actingAs($this->admin(), 'sanctum')
            ->getJson("/api/v1/reports/stock-overview?store_id={$store->id}")
            ->assertOk()->json('data');

        $this->assertSame(3, $data['tracked_products']);
        $this->assertSame(1, $data['out_of_stock']);
        $this->assertSame(1, $data['low_stock']);
        $this->assertSame(1, $data['healthy']);
        $this->assertSame(13, $data['units_on_hand']);
        $this->assertEquals(615.0, $data["stock_value_at_cost"]);     // 10 x 60.00 + 3 x 5.00
        $this->assertEquals(1030.0, $data["stock_value_at_retail"]);  // 10 x 100.00 + 3 x 10.00
    }

    public function test_insights_require_report_permission(): void
    {
        $store = Store::factory()->create();

        $this->actingAs(User::factory()->create(), 'sanctum')
            ->getJson("/api/v1/reports/stock-overview?store_id={$store->id}")
            ->assertForbidden();
    }
}
