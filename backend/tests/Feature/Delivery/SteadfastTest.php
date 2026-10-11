<?php

namespace Tests\Feature\Delivery;

use App\Models\Courier;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Couriers\SteadfastClient;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SteadfastTest extends TestCase
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

    private function courier(Store $store, array $overrides = []): Courier
    {
        return Courier::factory()->for($store)->create($overrides + [
            'provider' => 'steadfast',
            'api_key' => 'key-123',
            'api_secret' => 'secret-456',
        ]);
    }

    /** Subtotal 200.00 + shipping 50.00 = 250.00, shipped, COD. */
    private function shippedOrder(Store $store, array $overrides = []): Order
    {
        $order = Order::factory()->for($store)
            ->for(Customer::factory()->for($store)->create())
            ->for(Warehouse::factory()->for($store)->create())
            ->create($overrides + [
                'status' => 'shipped',
                'payment_method' => 'cod',
                'payment_status' => 'unpaid',
                'shipping_amount' => 5000,
                'discount_amount' => 0,
                'shipping_recipient_name' => 'Nusrat Rahman',
                'shipping_phone' => '+880 1712-345678',
                'shipping_address_line' => 'House 5, Road 3, Dhanmondi, Dhaka',
            ]);

        $order->items()->create([
            'product_id' => Product::factory()->for($store)->create()->id,
            'quantity' => 2,
            'unit_price_amount' => 10000,
        ]);

        return $order;
    }

    public function test_phone_numbers_are_normalised_to_the_local_format(): void
    {
        $this->assertSame('01712345678', SteadfastClient::normalisePhone('+880 1712-345678'));
        $this->assertSame('01712345678', SteadfastClient::normalisePhone('8801712345678'));
        $this->assertSame('01912345678', SteadfastClient::normalisePhone('01912345678'));
        $this->assertNull(SteadfastClient::normalisePhone('12345'));
        $this->assertNull(SteadfastClient::normalisePhone('02-9999999'));
    }

    public function test_an_order_is_booked_with_steadfast_and_recorded_as_a_shipment(): void
    {
        Http::fake([
            'portal.packzy.com/api/v1/create_order' => Http::response([
                'status' => 200,
                'message' => 'Consignment has been created successfully.',
                'consignment' => ['consignment_id' => 1424107, 'tracking_code' => '15BAEB8A', 'status' => 'in_review'],
            ]),
        ]);

        $store = Store::factory()->create();
        $courier = $this->courier($store);
        $order = $this->shippedOrder($store);

        $this->actingAs($this->admin(), 'sanctum')
            ->postJson("/api/v1/orders/{$order->id}/send-to-courier", ['courier_id' => $courier->id, 'note' => 'Call first'])
            ->assertCreated()
            ->assertJsonPath('data.tracking_number', '15BAEB8A')
            ->assertJsonPath('data.external_id', '1424107')
            ->assertJsonPath('data.courier_status', 'in_review')
            ->assertJsonPath('data.status', 'pending_pickup');

        Http::assertSent(fn ($request) => $request->url() === 'https://portal.packzy.com/api/v1/create_order'
            && $request->header('Api-Key')[0] === 'key-123'
            && $request->header('Secret-Key')[0] === 'secret-456'
            && $request['invoice'] === $order->order_number
            && $request['recipient_phone'] === '01712345678'
            && (float) $request['cod_amount'] === 250.0
            && $request['note'] === 'Call first');

        $this->assertDatabaseHas('shipments', ['order_id' => $order->id, 'external_id' => '1424107']);
    }

    public function test_prepaid_orders_are_booked_with_zero_cod(): void
    {
        Http::fake(['*' => Http::response([
            'consignment' => ['consignment_id' => 9, 'tracking_code' => 'ABC', 'status' => 'in_review'],
        ])]);

        $store = Store::factory()->create();
        $order = $this->shippedOrder($store, ['payment_method' => 'bkash']);

        $this->actingAs($this->admin(), 'sanctum')
            ->postJson("/api/v1/orders/{$order->id}/send-to-courier", ['courier_id' => $this->courier($store)->id])
            ->assertCreated();

        Http::assertSent(fn ($request) => (float) $request['cod_amount'] === 0.0);
    }

    public function test_a_steadfast_rejection_creates_no_shipment(): void
    {
        Http::fake(['*' => Http::response(['status' => 400, 'errors' => ['invoice' => ['The invoice has already been taken.']]], 400)]);

        $store = Store::factory()->create();
        $order = $this->shippedOrder($store);

        $this->actingAs($this->admin(), 'sanctum')
            ->postJson("/api/v1/orders/{$order->id}/send-to-courier", ['courier_id' => $this->courier($store)->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Steadfast: The invoice has already been taken.');

        $this->assertDatabaseCount('shipments', 0);
    }

    public function test_an_invalid_phone_number_is_refused_before_calling_steadfast(): void
    {
        Http::fake();

        $store = Store::factory()->create();
        $order = $this->shippedOrder($store, ['shipping_phone' => '12345']);

        $this->actingAs($this->admin(), 'sanctum')
            ->postJson("/api/v1/orders/{$order->id}/send-to-courier", ['courier_id' => $this->courier($store)->id])
            ->assertStatus(422);

        Http::assertNothingSent();
    }

    public function test_a_manual_courier_cannot_use_the_api_route(): void
    {
        Http::fake();

        $store = Store::factory()->create();
        $order = $this->shippedOrder($store);
        $manual = Courier::factory()->for($store)->create(['provider' => 'manual']);

        $this->actingAs($this->admin(), 'sanctum')
            ->postJson("/api/v1/orders/{$order->id}/send-to-courier", ['courier_id' => $manual->id])
            ->assertStatus(422);

        Http::assertNothingSent();
    }

    public function test_credentials_are_stored_encrypted_and_never_returned(): void
    {
        $store = Store::factory()->create();
        $admin = $this->admin();

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/couriers', [
                'store_id' => $store->id,
                'name' => 'Steadfast',
                'provider' => 'steadfast',
                'api_key' => 'my-key',
                'api_secret' => 'my-secret',
            ])->assertCreated()
            ->assertJsonPath('data.provider', 'steadfast')
            ->assertJsonPath('data.has_credentials', true);

        $this->assertStringNotContainsString('my-secret', $response->getContent());

        $id = $response->json('data.id');
        $this->assertNotSame('my-secret', \DB::table('couriers')->where('id', $id)->value('api_secret'));

        // A blank secret on edit keeps the stored one.
        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/couriers/{$id}", ['store_id' => $store->id, 'name' => 'Steadfast BD', 'provider' => 'steadfast', 'api_key' => '', 'api_secret' => ''])
            ->assertOk()
            ->assertJsonPath('data.has_credentials', true);

        $this->assertSame('my-secret', Courier::find($id)->api_secret);
    }

    public function test_connection_test_and_status_sync(): void
    {
        Http::fake([
            '*/get_balance' => Http::response(['status' => 200, 'current_balance' => 1250.5]),
            '*/status_by_cid/*' => Http::response(['status' => 200, 'delivery_status' => 'delivered']),
            '*/create_order' => Http::response(['consignment' => ['consignment_id' => 77, 'tracking_code' => 'TRK77', 'status' => 'in_review']]),
        ]);

        $store = Store::factory()->create();
        $admin = $this->admin();
        $courier = $this->courier($store);
        $order = $this->shippedOrder($store);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/couriers/{$courier->id}/test-connection")
            ->assertOk()
            ->assertJsonPath('data.balance', 1250.5);

        $shipmentId = $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/orders/{$order->id}/send-to-courier", ['courier_id' => $courier->id])
            ->json('data.id');

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/shipments/{$shipmentId}/sync-courier")
            ->assertOk()
            ->assertJsonPath('data.courier_status', 'delivered');
    }
}
