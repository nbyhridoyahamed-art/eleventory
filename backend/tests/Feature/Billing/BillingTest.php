<?php

namespace Tests\Feature\Billing;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Store;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Billing\BillingService;
use App\Services\Billing\Gateways\PaymentResult;
use App\Services\Billing\PlanLimits;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Phase 5: plans, trials, invoices, limits, lapse and recovery. */
class BillingTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;

    private Organization $org;

    private User $owner;

    private BillingService $billing;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        config(['app.saas_mode' => true, 'billing.gateway' => 'fake']);

        $this->store = Store::factory()->create(['status' => 'active']);
        $this->org = $this->store->organization;
        $this->owner = User::factory()->create(['current_store_id' => $this->store->id]);
        $this->owner->stores()->attach($this->store->id, ['is_owner' => true, 'status' => 'active']);
        $this->owner->assignRole('Super Admin');

        $this->billing = app(BillingService::class);
    }

    private function plan(string $key): Plan
    {
        return Plan::where('key', $key)->firstOrFail();
    }

    private function headers(): array
    {
        return ['X-Store-Id' => (string) $this->store->id];
    }

    public function test_plans_are_public_and_hide_the_legacy_plan(): void
    {
        $keys = collect($this->getJson('/api/v1/plans')->assertOk()->json('data'))->pluck('key')->all();

        $this->assertSame(['starter', 'growth', 'pro'], $keys);
    }

    public function test_an_account_without_a_subscription_is_unlimited(): void
    {
        $this->assertNull(app(PlanLimits::class)->subscription($this->org));
        app(PlanLimits::class)->assertCanAdd($this->store->id, 'products', 100000);
        $this->assertTrue(true);
    }

    public function test_a_trial_starts_and_limits_follow_the_plan(): void
    {
        $sub = $this->billing->startTrial($this->org);
        $this->assertSame(Subscription::TRIALING, $sub->status);

        $this->billing->subscribe($this->org, $this->plan('starter'), 'monthly');
        $this->plan('starter')->update(['limits' => array_merge($this->plan('starter')->limits, ['products' => 1])]);
        $this->billing->markPaid(Invoice::where('organization_id', $this->org->id)->firstOrFail());
        app(PlanLimits::class)->flush();

        Product::factory()->create(['store_id' => $this->store->id]);

        $this->actingAs($this->owner, 'sanctum')->withHeaders($this->headers())
            ->postJson('/api/v1/products', ['name' => 'Second', 'slug' => 'second', 'sku' => 'S-2', 'price' => 10])
            ->assertStatus(402)
            ->assertJsonPath('errors.code.0', 'plan_limit_reached');
    }

    public function test_paying_an_invoice_activates_the_plan_and_is_idempotent(): void
    {
        $this->billing->startTrial($this->org);
        $invoice = $this->billing->subscribe($this->org, $this->plan('growth'), 'monthly');

        $this->assertSame('open', $invoice->status);

        $this->billing->markPaid($invoice);
        $this->billing->markPaid($invoice->fresh());

        $sub = Subscription::where('organization_id', $this->org->id)->firstOrFail();
        $this->assertSame(Subscription::ACTIVE, $sub->status);
        $this->assertSame('growth', $sub->plan->key);
        $this->assertSame(1, Invoice::where('organization_id', $this->org->id)->where('status', 'paid')->count());
        $this->assertNotNull($sub->current_period_end);
    }

    public function test_a_payment_for_the_wrong_amount_is_refused(): void
    {
        $this->billing->startTrial($this->org);
        $invoice = $this->billing->subscribe($this->org, $this->plan('growth'), 'monthly');

        $this->billing->handlePayment(new PaymentResult($invoice->tran_id, true, '1.00', $invoice->currency));

        $this->assertSame('open', $invoice->fresh()->status);
        $this->assertSame(Subscription::TRIALING, Subscription::where('organization_id', $this->org->id)->firstOrFail()->status);
    }

    public function test_a_lapsed_trial_goes_past_due_then_suspends_the_store_and_payment_reopens_it(): void
    {
        $sub = $this->billing->startTrial($this->org);
        $sub->update(['trial_ends_at' => now()->subDay()]);

        $this->billing->runLifecycle();
        $this->assertSame(Subscription::PAST_DUE, $sub->fresh()->status);
        $this->assertSame('active', $this->store->fresh()->status);

        $this->billing->runLifecycle(now()->addDays((int) config('billing.grace_days') + 2));
        $this->assertSame(Subscription::SUSPENDED, $sub->fresh()->status);
        $this->assertSame('suspended', $this->store->fresh()->status);
        $this->assertSame('billing', $this->store->fresh()->suspension_reason);

        // Writes are refused, reads still work.
        $this->actingAs($this->owner, 'sanctum')->withHeaders($this->headers())
            ->postJson('/api/v1/products', ['name' => 'X', 'slug' => 'x', 'sku' => 'X-1', 'price' => 1])
            ->assertStatus(402)->assertJsonPath('errors.code.0', 'subscription_inactive');

        $invoice = $this->billing->subscribe($this->org, $this->plan('starter'), 'monthly');
        $this->billing->markPaid($invoice);

        $this->assertSame(Subscription::ACTIVE, $sub->fresh()->status);
        $this->assertSame('active', $this->store->fresh()->status);
    }

    public function test_payment_does_not_reopen_a_store_the_platform_suspended(): void
    {
        $sub = $this->billing->startTrial($this->org);
        $this->store->update(['status' => 'suspended', 'suspension_reason' => 'platform']);

        $this->billing->markPaid($this->billing->subscribe($this->org, $this->plan('starter'), 'monthly'));

        $this->assertSame('suspended', $this->store->fresh()->status);
    }

    public function test_billing_endpoints_are_owner_only_and_scoped_to_the_own_account(): void
    {
        $this->billing->startTrial($this->org);

        $other = Store::factory()->create(['status' => 'active']);
        $theirs = $this->billing->subscribe($other->organization, $this->plan('growth'), 'monthly');

        $this->actingAs($this->owner, 'sanctum')->withHeaders($this->headers())
            ->getJson('/api/v1/billing')->assertOk()
            ->assertJsonPath('data.subscription.status', 'trialing');

        $this->actingAs($this->owner, 'sanctum')->withHeaders($this->headers())
            ->postJson("/api/v1/billing/invoices/{$theirs->id}/pay")->assertNotFound();
    }

    public function test_the_fake_gateway_is_off_outside_development(): void
    {
        config(['billing.gateway' => 'manual']);
        $this->billing->startTrial($this->org);
        $invoice = $this->billing->subscribe($this->org, $this->plan('growth'), 'monthly');

        $this->get("/api/v1/billing/fake/{$invoice->tran_id}/pay")->assertNotFound();
        $this->assertSame('open', $invoice->fresh()->status);
    }
}
