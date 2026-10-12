<?php

namespace Tests\Feature\Dashboard;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardInsightsTest extends TestCase
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

    public function test_insights_summarise_the_period_and_compare_with_the_previous_one(): void
    {
        $store = Store::factory()->create();
        $customer = Customer::factory()->for($store)->create();
        $warehouse = Warehouse::factory()->for($store)->create();
        $category = Category::factory()->for($store)->create(['name' => 'Audio']);
        $product = Product::factory()->for($store)->create(['name' => 'Earbuds', 'category_id' => $category->id]);

        $make = function (string $when, string $status = 'delivered', string $method = 'cod', string $source = 'storefront', int $qty = 2) use ($store, $customer, $warehouse, $product) {
            $order = Order::factory()->for($store)->for($customer)->for($warehouse)->create([
                'status' => $status, 'payment_method' => $method, 'source' => $source, 'created_at' => $when,
            ]);
            $order->items()->create(['product_id' => $product->id, 'quantity' => $qty, 'unit_price_amount' => 10000]);
        };

        $make(now()->subDays(2)->toDateTimeString());                         // current, 200.00
        $make(now()->subDay()->toDateTimeString(), 'delivered', 'bkash', 'admin', 1); // current, 100.00
        $make(now()->subDays(1)->toDateTimeString(), 'cancelled');           // ignored
        $make(now()->subDays(40)->toDateTimeString(), 'delivered', 'cod', 'storefront', 1); // previous period, 100.00

        $data = $this->actingAs($this->admin(), 'sanctum')
            ->getJson("/api/v1/dashboard/insights?store_id={$store->id}&days=30")
            ->assertOk()
            ->json('data');

        $this->assertEquals(300.0, $data['kpis']['revenue']['value']);
        $this->assertEquals(100.0, $data['kpis']['revenue']['previous']);
        $this->assertEquals(200.0, $data['kpis']['revenue']['change_percent']);
        $this->assertSame(2, $data['kpis']['orders']['value']);
        $this->assertEquals(150.0, $data['kpis']['average_order_value']['value']);
        $this->assertEquals(33.3, $data['kpis']['cancellation_rate']);

        $this->assertSame('Earbuds', $data['top_products'][0]['name']);
        $this->assertSame(3, $data['top_products'][0]['units']);
        $this->assertSame('Audio', $data['sales_by_category'][0]['name']);
        $this->assertEqualsCanonicalizing(['cod', 'bkash'], array_column($data['payment_methods'], 'method'));
        $this->assertCount(7, $data['orders_by_weekday']);
        $this->assertCount(24, $data['orders_by_hour']);
        $this->assertCount(6, $data['shipment_pipeline']);
    }

    public function test_insights_require_the_orders_permission(): void
    {
        $store = Store::factory()->create();

        $this->actingAs(User::factory()->create(), 'sanctum')
            ->getJson("/api/v1/dashboard/insights?store_id={$store->id}")
            ->assertForbidden();
    }
}
