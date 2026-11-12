<?php

namespace Tests\Feature\Payments;

use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Plan;
use App\Models\Product;
use App\Models\StockLevel;
use App\Models\Store;
use App\Models\StorePaymentGateway;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\Billing\BillingService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Phase 7: a store's own payment providers, verified webhooks, exactly-once settlement, refunds. */
class MerchantPaymentsTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;

    private User $owner;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        $this->store = Store::factory()->create(['status' => 'active']);
        $this->owner = User::factory()->create(['current_store_id' => $this->store->id]);
        $this->owner->stores()->attach($this->store->id, ['is_owner' => true, 'status' => 'active']);
        $this->owner->assignRole('Super Admin');

        $warehouse = Warehouse::factory()->for($this->store)->create();
        $this->product = Product::factory()->for($this->store)->create(['status' => 'active', 'price_amount' => 50000]);
        StockLevel::factory()->for($this->product)->for($warehouse)->create(['quantity' => 20, 'quantity_reserved' => 0]);
    }

    private function enable(string $provider, array $credentials = [], bool $test = true): StorePaymentGateway
    {
        return StorePaymentGateway::forceCreate([
            'store_id' => $this->store->id, 'provider' => $provider, 'is_enabled' => true, 'test_mode' => $test, 'credentials' => $credentials,
        ]);
    }

    private function checkout(string $method = 'cod'): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/v1/storefront/checkout', [
            'customer_name' => 'Karim Rahman', 'customer_phone' => '01712345678',
            'shipping_recipient_name' => 'Karim Rahman', 'shipping_phone' => '01712345678', 'shipping_address_line' => 'House 1, Dhaka',
            'payment_method' => $method,
            'items' => [['product_id' => $this->product->id, 'quantity' => 2]],
        ]);
    }

    private function stripeHeaders(string $body, string $secret, ?int $time = null): array
    {
        $time ??= time();

        return ['Stripe-Signature' => "t={$time},v1=".hash_hmac('sha256', "{$time}.{$body}", $secret)];
    }

    // ---- settings -------------------------------------------------------------------------

    public function test_credentials_are_saved_encrypted_and_never_returned(): void
    {
        $response = $this->actingAs($this->owner, 'sanctum')->putJson('/api/v1/payment-gateways/sslcommerz', [
            'is_enabled' => true, 'test_mode' => true, 'credentials' => ['store_id' => 'mystore123', 'store_password' => 'sup3r-secret'],
        ])->assertOk();

        $this->assertStringNotContainsString('sup3r-secret', $response->getContent());
        $this->assertStringNotContainsString('mystore123', $response->getContent());
        $this->assertStringNotContainsString('sup3r-secret', (string) DB::table('store_payment_gateways')->value('credentials'));

        $list = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/payment-gateways')->assertOk();
        $this->assertStringNotContainsString('sup3r-secret', $list->getContent());
        $this->assertTrue(collect($list->json('data'))->firstWhere('key', 'sslcommerz')['fields'][1]['saved']);

        // A blank secret keeps the saved one.
        $this->actingAs($this->owner, 'sanctum')->putJson('/api/v1/payment-gateways/sslcommerz', [
            'is_enabled' => true, 'test_mode' => false, 'credentials' => ['store_id' => 'mystore123', 'store_password' => ''],
        ])->assertOk();
        $this->assertSame('sup3r-secret', StorePaymentGateway::first()->credential('store_password'));
    }

    public function test_bad_credentials_cannot_be_switched_on_and_live_mode_needs_live_keys(): void
    {
        $this->actingAs($this->owner, 'sanctum')->putJson('/api/v1/payment-gateways/sslcommerz', ['is_enabled' => true, 'test_mode' => true, 'credentials' => []])
            ->assertStatus(422);

        $this->actingAs($this->owner, 'sanctum')->putJson('/api/v1/payment-gateways/stripe', [
            'is_enabled' => true, 'test_mode' => false, 'credentials' => ['secret_key' => 'sk_test_abc', 'webhook_secret' => 'whsec_x'],
        ])->assertStatus(422);

        $this->assertSame(0, StorePaymentGateway::count());
    }

    public function test_only_people_who_manage_settings_can_change_gateways(): void
    {
        $viewer = User::factory()->create(['current_store_id' => $this->store->id]);
        $this->actingAs($viewer, 'sanctum')->getJson('/api/v1/payment-gateways')->assertForbidden();
    }

    public function test_online_payments_are_a_plan_feature(): void
    {
        config(['app.saas_mode' => true]);
        app(BillingService::class)->override($this->store->organization, Plan::where('key', 'starter')->firstOrFail(), 'active');

        $this->actingAs($this->owner, 'sanctum')->putJson('/api/v1/payment-gateways/fake', ['is_enabled' => true, 'test_mode' => true])
            ->assertStatus(402)->assertJsonPath('errors.code.0', 'plan_feature_missing');
    }

    // ---- checkout and settlement ----------------------------------------------------------

    public function test_a_shop_offers_only_what_it_enabled_and_refuses_the_rest(): void
    {
        $this->getJson('/api/v1/storefront/payment-methods')->assertOk()->assertJson(['data' => []]);
        $this->checkout('fake')->assertStatus(422);

        $this->enable('fake');
        $this->getJson('/api/v1/storefront/payment-methods')->assertJsonPath('data.0.key', 'fake');
        $this->checkout('nonsense')->assertStatus(422);
    }

    public function test_paying_online_records_the_money_exactly_once(): void
    {
        $this->enable('fake');

        $response = $this->checkout('fake')->assertCreated()->assertJsonPath('data.payment_method', 'fake');
        $url = $response->json('data.payment.redirect_url');
        $this->assertStringContainsString('/api/v1/payments/fake/', $url);

        $order = Order::firstOrFail();
        $this->assertSame('unpaid', $order->payment_status);

        $path = parse_url($url, PHP_URL_PATH);
        $this->get($path)->assertRedirect();
        $this->get($path)->assertRedirect(); // the shopper pressing back/refresh, or a retry

        $this->assertSame(1, Payment::count());
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame(PaymentAttempt::PAID, PaymentAttempt::firstOrFail()->status);
        $this->assertSame(100000, Payment::firstOrFail()->amount_amount);
    }

    public function test_a_result_for_the_wrong_amount_never_marks_the_order_paid(): void
    {
        $this->enable('fake');
        $this->checkout('fake')->assertCreated();
        $attempt = PaymentAttempt::firstOrFail();

        app(\App\Services\Payments\MerchantPayments::class)->settle($attempt, new \App\Services\Payments\GatewayPayment($attempt->tran_id, true, 100, 'BDT'));

        $this->assertSame(0, Payment::count());
        $this->assertSame(PaymentAttempt::MISMATCH, $attempt->fresh()->status);
        $this->assertSame('unpaid', Order::firstOrFail()->payment_status);
    }

    public function test_a_shopper_can_retry_payment_for_an_unpaid_order(): void
    {
        $this->enable('fake');
        $uuid = $this->checkout('fake')->json('data.uuid');

        $this->postJson("/api/v1/storefront/orders/{$uuid}/pay", ['provider' => 'fake'])->assertOk()
            ->assertJson(fn ($json) => $json->has('data.redirect_url')->etc());

        $this->assertSame(2, PaymentAttempt::count());
    }

    // ---- provider confirmations ------------------------------------------------------------

    public function test_sslcommerz_ipn_is_verified_with_the_provider_and_the_amount_checked(): void
    {
        $this->enable('sslcommerz', ['store_id' => 'sid', 'store_password' => 'pw']);
        Http::fake(['*/gwprocess/v4/api.php' => Http::response(['status' => 'SUCCESS', 'GatewayPageURL' => 'https://pay.example/x'])]);

        $this->checkout('sslcommerz')->assertCreated()->assertJsonPath('data.payment.redirect_url', 'https://pay.example/x');
        $attempt = PaymentAttempt::firstOrFail();

        // The provider says the money is real, for the right amount.
        Http::fake(['*/validator/api/validationserverAPI.php*' => Http::response([
            'status' => 'VALID', 'tran_id' => $attempt->tran_id, 'currency_amount' => '1000.00', 'currency_type' => 'BDT', 'bank_tran_id' => 'BANK1',
        ])]);

        $this->postJson("/api/v1/payments/webhooks/sslcommerz/{$this->store->id}", ['val_id' => 'V1'])->assertOk();

        $this->assertSame(PaymentAttempt::PAID, $attempt->fresh()->status);
        $this->assertSame('paid', Order::firstOrFail()->payment_status);
    }

    public function test_sslcommerz_forged_or_underpaid_notifications_do_not_pay_the_order(): void
    {
        $this->enable('sslcommerz', ['store_id' => 'sid', 'store_password' => 'pw']);
        Http::fake(['*/gwprocess/v4/api.php' => Http::response(['status' => 'SUCCESS', 'GatewayPageURL' => 'https://pay.example/x'])]);
        $this->checkout('sslcommerz')->assertCreated();
        $attempt = PaymentAttempt::firstOrFail();

        // Provider does not know this val_id.
        Http::fake(['*/validator/api/validationserverAPI.php*' => Http::response(['status' => 'INVALID_TRANSACTION'])]);
        $this->postJson("/api/v1/payments/webhooks/sslcommerz/{$this->store->id}", ['val_id' => 'FORGED', 'tran_id' => $attempt->tran_id, 'status' => 'VALID'])->assertOk();
        $this->assertSame(0, Payment::count());

        // Provider confirms a real payment, but for 1 taka.
        Http::fake(['*/validator/api/validationserverAPI.php*' => Http::response([
            'status' => 'VALID', 'tran_id' => $attempt->tran_id, 'currency_amount' => '1.00', 'currency_type' => 'BDT',
        ])]);
        $this->postJson("/api/v1/payments/webhooks/sslcommerz/{$this->store->id}", ['val_id' => 'V2'])->assertOk();
        $this->assertSame(0, Payment::count());
        $this->assertSame('unpaid', Order::firstOrFail()->payment_status);
    }

    public function test_stripe_webhooks_need_a_valid_fresh_signature(): void
    {
        $this->enable('stripe', ['secret_key' => 'sk_test_abc', 'webhook_secret' => 'whsec_good']);
        Http::fake(['api.stripe.com/v1/checkout/sessions' => Http::response(['id' => 'cs_1', 'url' => 'https://checkout.stripe.com/c/1'])]);
        $this->checkout('stripe')->assertCreated();
        $attempt = PaymentAttempt::firstOrFail();

        $body = json_encode(['id' => 'evt_1', 'type' => 'checkout.session.completed', 'data' => ['object' => [
            'client_reference_id' => $attempt->tran_id, 'payment_status' => 'paid', 'amount_total' => 100000, 'currency' => 'bdt', 'payment_intent' => 'pi_1',
        ]]]);
        $url = "/api/v1/payments/webhooks/stripe/{$this->store->id}";
        $post = fn (array $headers) => $this->call('POST', $url, [], [], [], $this->transformHeadersToServerVars($headers + ['Content-Type' => 'application/json']), $body);

        $post($this->stripeHeaders($body, 'whsec_WRONG'))->assertStatus(400);
        $post($this->stripeHeaders($body, 'whsec_good', time() - 3600))->assertStatus(400); // replay of an old event
        $post([])->assertStatus(400);
        $this->assertSame(0, Payment::count());

        $post($this->stripeHeaders($body, 'whsec_good'))->assertOk();
        $this->assertSame(PaymentAttempt::PAID, $attempt->fresh()->status);
        $this->assertSame('pi_1', $attempt->fresh()->provider_reference);
        $post($this->stripeHeaders($body, 'whsec_good'))->assertOk(); // Stripe retries
        $this->assertSame(1, Payment::count());
    }

    public function test_one_stores_webhook_cannot_settle_another_stores_payment(): void
    {
        $this->enable('fake');
        $this->checkout('fake')->assertCreated();
        config(['app.saas_mode' => true]);
        $attempt = PaymentAttempt::withoutGlobalScopes()->firstOrFail();

        $other = Store::factory()->create(['status' => 'active']);
        StorePaymentGateway::forceCreate(['store_id' => $other->id, 'provider' => 'stripe', 'is_enabled' => true, 'test_mode' => true,
            'credentials' => ['secret_key' => 'sk_test_x', 'webhook_secret' => 'whsec_other']]);

        $body = json_encode(['type' => 'checkout.session.completed', 'data' => ['object' => [
            'client_reference_id' => $attempt->tran_id, 'payment_status' => 'paid', 'amount_total' => 100000, 'currency' => 'bdt',
        ]]]);
        $this->call('POST', "/api/v1/payments/webhooks/stripe/{$other->id}", [], [], [], $this->transformHeadersToServerVars($this->stripeHeaders($body, 'whsec_other') + ['Content-Type' => 'application/json']), $body);

        $this->assertSame(0, Payment::withoutGlobalScopes()->count());
    }

    // ---- refunds ---------------------------------------------------------------------------

    public function test_refunds_go_through_the_gateway_and_cannot_exceed_what_was_paid(): void
    {
        $this->enable('fake');
        $url = $this->checkout('fake')->json('data.payment.redirect_url');
        $this->get(parse_url($url, PHP_URL_PATH));
        $order = Order::firstOrFail();

        $this->actingAs($this->owner, 'sanctum')->postJson("/api/v1/orders/{$order->id}/payments/refund", ['amount' => 400, 'reason' => 'Damaged'])
            ->assertCreated()->assertJsonPath('data.payment_status', 'partially_refunded');

        $this->actingAs($this->owner, 'sanctum')->postJson("/api/v1/orders/{$order->id}/payments/refund", ['amount' => 700])->assertStatus(422);
        $this->actingAs($this->owner, 'sanctum')->postJson("/api/v1/orders/{$order->id}/payments/refund", ['amount' => 600])
            ->assertCreated()->assertJsonPath('data.payment_status', 'refunded');

        $this->assertSame(100000, PaymentAttempt::firstOrFail()->refunded_minor);
        $this->assertSame(0, (int) Payment::sum('amount_amount'));
    }

    public function test_a_cod_order_has_nothing_to_refund_through_a_gateway(): void
    {
        $this->checkout('cod')->assertCreated();

        $this->actingAs($this->owner, 'sanctum')->postJson('/api/v1/orders/'.Order::firstOrFail()->id.'/payments/refund', ['amount' => 10])->assertStatus(422);
    }
}
