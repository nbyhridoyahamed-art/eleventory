<?php

namespace Tests\Feature\Customers;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\CustomerSegment;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerInsightsTest extends TestCase
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

    /** @param array<int, array{0: string, 1: int}> $orders [created_at, line total in minor units] */
    private function customerWith(Store $store, string $name, array $orders, string $status = 'delivered'): Customer
    {
        $customer = Customer::factory()->for($store)->create(['name' => $name]);
        $warehouse = Warehouse::factory()->for($store)->create();
        $product = Product::factory()->for($store)->create();

        foreach ($orders as [$when, $minor]) {
            $order = Order::factory()->for($store)->for($customer)->for($warehouse)->create(['status' => $status, 'created_at' => $when]);
            $order->items()->create(['product_id' => $product->id, 'quantity' => 1, 'unit_price_amount' => $minor]);
        }

        return $customer;
    }

    public function test_segment_labels_follow_the_rules(): void
    {
        $now = now();

        $this->assertSame('new', CustomerSegment::label(0, 0, null, $now));
        $this->assertSame('one_time', CustomerSegment::label(1, 50000, $now->copy()->subDays(5)->toDateTimeString(), $now));
        $this->assertSame('repeat', CustomerSegment::label(3, 50000, $now->copy()->subDays(5)->toDateTimeString(), $now));
        $this->assertSame('at_risk', CustomerSegment::label(2, 50000, $now->copy()->subDays(80)->toDateTimeString(), $now));
        $this->assertSame('inactive', CustomerSegment::label(1, 50000, $now->copy()->subDays(200)->toDateTimeString(), $now));
        $this->assertSame('vip', CustomerSegment::label(1, 2_500_000, $now->copy()->subDays(200)->toDateTimeString(), $now));
        $this->assertSame('vip', CustomerSegment::label(5, 10000, $now->toDateTimeString(), $now));
    }

    public function test_list_exposes_spend_segment_and_supports_filter_and_sort(): void
    {
        $store = Store::factory()->create();
        $this->customerWith($store, 'Big Spender', [[now()->subDays(3)->toDateTimeString(), 3_000_000]]);
        $this->customerWith($store, 'Small Buyer', [[now()->subDays(2)->toDateTimeString(), 50_000]]);
        $this->customerWith($store, 'Cancelled Only', [[now()->subDays(2)->toDateTimeString(), 90_000]], 'cancelled');
        Customer::factory()->for($store)->create(['name' => 'Window Shopper']);
        $admin = $this->admin();

        $all = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/customers?store_id={$store->id}&sort=spend&direction=desc")
            ->assertOk()->json('data');

        $this->assertSame('Big Spender', $all[0]['name']);
        $this->assertEquals(30000.0, $all[0]['lifetime_spend']);
        $this->assertSame('vip', $all[0]['segment']);

        $byName = collect($all)->keyBy('name');
        $this->assertSame('one_time', $byName['Small Buyer']['segment']);
        $this->assertSame('new', $byName['Cancelled Only']['segment']);
        $this->assertEquals(0.0, $byName['Cancelled Only']['lifetime_spend']);
        $this->assertSame('new', $byName['Window Shopper']['segment']);

        $vips = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/customers?store_id={$store->id}&segment=vip")
            ->assertOk()->json('data');
        $this->assertCount(1, $vips);
        $this->assertSame('Big Spender', $vips[0]['name']);

        $none = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/customers?store_id={$store->id}&segment=new")
            ->json('data');
        $this->assertCount(2, $none);
    }

    public function test_summary_reports_totals_segments_and_top_customers(): void
    {
        $store = Store::factory()->create();
        $this->customerWith($store, 'Loyal', [
            [now()->subDays(10)->toDateTimeString(), 100_000],
            [now()->subDays(4)->toDateTimeString(), 150_000],
        ]);
        $this->customerWith($store, 'Once', [[now()->subDays(3)->toDateTimeString(), 50_000]]);
        Customer::factory()->for($store)->create(['name' => 'Lurker']);

        $data = $this->actingAs($this->admin(), 'sanctum')
            ->getJson("/api/v1/customers/summary?store_id={$store->id}")
            ->assertOk()->json('data');

        $this->assertSame(3, $data['total_customers']);
        $this->assertSame(2, $data['with_orders']);
        $this->assertEquals(50.0, $data['repeat_rate']);
        $this->assertEquals(3000.0, $data['total_lifetime_value']);
        $this->assertEquals(1500.0, $data['average_lifetime_value']);
        $this->assertSame('Loyal', $data['top_customers'][0]['name']);

        $segments = collect($data['segments'])->pluck('count', 'key');
        $this->assertSame(1, $segments['repeat']);
        $this->assertSame(1, $segments['one_time']);
        $this->assertSame(1, $segments['new']);
    }
}
