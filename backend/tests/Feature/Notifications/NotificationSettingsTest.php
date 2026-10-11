<?php

namespace Tests\Feature\Notifications;

use App\Models\Customer;
use App\Models\NotificationLog;
use App\Models\NotificationSetting;
use App\Models\Order;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use App\Notifications\Channels\SmsChannel;
use App\Notifications\OrderPlacedNotification;
use App\Services\Sms\BulkSmsBdGateway;
use App\Support\NotificationRouter;
use App\Support\SafeNotification;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class NotificationSettingsTest extends TestCase
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

    private function order(Store $store, array $customer = []): Order
    {
        return Order::factory()->for($store)
            ->for(Customer::factory()->for($store)->create($customer + ['phone' => '01712345678', 'email' => 'buyer@example.com']))
            ->for(Warehouse::factory()->for($store)->create())
            ->create();
    }

    public function test_settings_are_saved_and_secrets_are_never_returned(): void
    {
        $admin = $this->admin();
        $store = Store::factory()->create();

        $response = $this->actingAs($admin, 'sanctum')->putJson('/api/v1/notification-settings', [
            'store_id' => $store->id,
            'sms' => ['enabled' => true, 'api_key' => 'sms-secret-key', 'sender_id' => '8809617'],
            'email' => ['enabled' => true, 'host' => 'smtp.example.com', 'port' => 587, 'password' => 'smtp-secret', 'from_address' => 'shop@example.com'],
        ])->assertOk()
            ->assertJsonPath('data.settings.sms.has_api_key', true)
            ->assertJsonPath('data.settings.email.has_password', true)
            ->assertJsonPath('data.settings.sms.sender_id', '8809617');

        $this->assertStringNotContainsString('sms-secret-key', $response->getContent());
        $this->assertStringNotContainsString('smtp-secret', $response->getContent());

        // A blank secret keeps what is stored.
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/notification-settings', [
            'store_id' => $store->id,
            'sms' => ['api_key' => '', 'sender_id' => 'NEWID'],
        ])->assertOk();

        $stored = NotificationSetting::forStore($store->id);
        $this->assertSame('sms-secret-key', $stored['sms']['api_key']);
        $this->assertSame('NEWID', $stored['sms']['sender_id']);
        $this->assertSame('smtp-secret', $stored['email']['password']);
    }

    public function test_settings_require_the_settings_permission(): void
    {
        $store = Store::factory()->create();

        $this->actingAs(User::factory()->create(), 'sanctum')
            ->getJson("/api/v1/notification-settings?store_id={$store->id}")
            ->assertForbidden();
    }

    public function test_sms_goes_through_bulksmsbd_with_the_stores_credentials(): void
    {
        Http::fake(['bulksmsbd.net/api/smsapi' => Http::response(['response_code' => 202, 'success_message' => 'SMS Submitted Successfully'])]);

        $store = Store::factory()->create(['name' => 'Eleventory']);
        NotificationSetting::create(['store_id' => $store->id, 'data' => NotificationSetting::merge([
            'sms' => ['enabled' => true, 'api_key' => 'key-1', 'sender_id' => 'ELEVEN'],
            'email' => ['enabled' => false],
        ])]);
        $order = $this->order($store);

        SafeNotification::send($order->customer, new OrderPlacedNotification($order));

        Http::assertSent(fn ($request) => $request->url() === 'http://bulksmsbd.net/api/smsapi'
            && $request['api_key'] === 'key-1'
            && $request['senderid'] === 'ELEVEN'
            && $request['number'] === '8801712345678'
            && str_contains($request['message'], $order->order_number));

        $this->assertDatabaseHas('notification_logs', ['channel' => 'sms', 'status' => 'sent', 'event' => 'order_placed']);
    }

    public function test_a_provider_error_is_logged_and_never_breaks_the_caller(): void
    {
        Http::fake(['bulksmsbd.net/*' => Http::response(['response_code' => 1007, 'error_message' => 'Balance low'])]);

        $store = Store::factory()->create();
        NotificationSetting::create(['store_id' => $store->id, 'data' => NotificationSetting::merge([
            'sms' => ['enabled' => true, 'api_key' => 'key-1'],
        ])]);
        $order = $this->order($store);

        SafeNotification::send($order->customer, new OrderPlacedNotification($order));

        $log = NotificationLog::query()->where('channel', 'sms')->firstOrFail();
        $this->assertSame('failed', $log->status);
        $this->assertStringContainsString('Insufficient balance', $log->error);
    }

    public function test_an_unreachable_smtp_server_is_logged_and_never_breaks_the_caller(): void
    {
        $store = Store::factory()->create();
        NotificationSetting::create(['store_id' => $store->id, 'data' => NotificationSetting::merge([
            'email' => ['enabled' => true, 'host' => '127.0.0.1', 'port' => 1, 'encryption' => 'none', 'from_address' => 'shop@example.com'],
        ])]);
        $order = $this->order($store);

        SafeNotification::send($order->customer, new OrderPlacedNotification($order));

        $this->assertDatabaseHas('notification_logs', ['channel' => 'email', 'status' => 'failed', 'event' => 'order_placed']);
    }

    public function test_disabled_events_and_channels_send_nothing(): void
    {
        Http::fake();

        $store = Store::factory()->create();
        NotificationSetting::create(['store_id' => $store->id, 'data' => NotificationSetting::merge([
            'sms' => ['enabled' => true, 'api_key' => 'key-1'],
            'events' => ['order_placed' => ['sms' => false, 'email' => false]],
        ])]);
        $order = $this->order($store);

        $this->assertSame([], NotificationRouter::channels($order->customer, 'order_placed'));
        $this->assertSame([SmsChannel::class], NotificationRouter::channels($order->customer, 'order_shipped'));

        SafeNotification::send($order->customer, new OrderPlacedNotification($order));

        Http::assertNothingSent();
    }

    public function test_templates_replace_placeholders(): void
    {
        $store = Store::factory()->create(['name' => 'Eleventory']);
        NotificationSetting::create(['store_id' => $store->id, 'data' => NotificationSetting::merge([
            'sms' => ['enabled' => true],
            'templates' => ['order_placed' => ['sms' => 'Hi {customer}, {order_number} confirmed - {store}']],
        ])]);
        $order = $this->order($store, ['name' => 'Rahim']);

        $this->assertSame(
            "Hi Rahim, {$order->order_number} confirmed - Eleventory",
            (new OrderPlacedNotification($order))->toSms($order->customer),
        );
    }

    public function test_numbers_are_formatted_for_bulksmsbd(): void
    {
        $this->assertSame('8801712345678', BulkSmsBdGateway::formatNumber('01712345678'));
        $this->assertSame('8801712345678', BulkSmsBdGateway::formatNumber('+880 1712-345678'));
        $this->assertNull(BulkSmsBdGateway::formatNumber('12345'));
    }

    public function test_balance_check_and_test_sms_endpoints(): void
    {
        Http::fake([
            'bulksmsbd.net/api/getBalanceApi*' => Http::response(['balance' => 245.5]),
            'bulksmsbd.net/api/smsapi' => Http::response(['response_code' => 202]),
        ]);

        $admin = $this->admin();
        $store = Store::factory()->create();
        NotificationSetting::create(['store_id' => $store->id, 'data' => NotificationSetting::merge([
            'sms' => ['enabled' => true, 'api_key' => 'key-1'],
        ])]);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/notification-settings/sms-balance?store_id={$store->id}")
            ->assertOk()->assertJsonPath('data.balance', 245.5);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/notification-settings/test-sms', ['store_id' => $store->id, 'phone' => '01812345678'])
            ->assertOk();

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/notification-logs?store_id={$store->id}")
            ->assertOk()->assertJsonPath('data.0.event', 'test');
    }

    public function test_unconfigured_stores_keep_the_original_behaviour(): void
    {
        $store = Store::factory()->create();
        $order = $this->order($store);

        $this->assertSame(['mail', SmsChannel::class], NotificationRouter::channels($order->customer, 'order_placed'));
    }
}
