<?php

namespace Tests\Feature\Platform;

use App\Models\AbuseReport;
use App\Models\Announcement;
use App\Models\Plan;
use App\Models\PlatformAuditLog;
use App\Models\Product;
use App\Models\Store;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Billing\BillingService;
use App\Services\Billing\PlanLimits;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/** Phase 6: the platform area is for platform admins only, and everything they do leaves a trace. */
class PlatformAdminTest extends TestCase
{
    use RefreshDatabase;

    private Store $shop;

    private User $owner;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        config(['app.saas_mode' => true]);

        $home = Store::factory()->create(['name' => 'Platform HQ', 'status' => 'active']);
        $this->admin = User::factory()->create(['current_store_id' => $home->id]);
        $this->admin->stores()->attach($home->id, ['is_owner' => true, 'status' => 'active']);
        Role::findOrCreate('Platform Admin', 'web');
        $this->admin->assignRole('Platform Admin');

        $this->shop = Store::factory()->create(['name' => 'Rahim Fashion', 'slug' => 'rahim', 'status' => 'active']);
        $this->owner = User::factory()->create(['current_store_id' => $this->shop->id]);
        $this->owner->stores()->attach($this->shop->id, ['is_owner' => true, 'status' => 'active']);
        $this->owner->assignRole('Super Admin');
    }

    private function asAdmin(): static
    {
        return $this->actingAs($this->admin, 'sanctum');
    }

    public function test_store_owners_cannot_enter_the_platform_area(): void
    {
        $this->getJson('/api/v1/platform/overview')->assertUnauthorized();

        foreach (['overview', 'tenants', 'audit-log', 'reports', 'announcements'] as $path) {
            $this->actingAs($this->owner, 'sanctum')->getJson("/api/v1/platform/{$path}")->assertForbidden();
        }

        $this->actingAs($this->owner, 'sanctum')->postJson("/api/v1/platform/tenants/{$this->shop->id}/suspend", ['reason' => 'x'])->assertForbidden();
    }

    public function test_the_platform_area_is_closed_when_saas_mode_is_off(): void
    {
        config(['app.saas_mode' => false]);

        $this->asAdmin()->getJson('/api/v1/platform/overview')->assertForbidden();
    }

    public function test_directory_lists_and_searches_shops(): void
    {
        $names = collect($this->asAdmin()->getJson('/api/v1/platform/tenants?search=rahim')->assertOk()->json('data'))->pluck('name')->all();

        $this->assertSame(['Rahim Fashion'], $names);
    }

    public function test_suspend_and_restore_are_audited_and_close_the_storefront(): void
    {
        $this->asAdmin()->postJson("/api/v1/platform/tenants/{$this->shop->id}/suspend", ['reason' => 'Selling counterfeits'])
            ->assertOk()->assertJsonPath('data.status', 'suspended')->assertJsonPath('data.suspension_reason', 'platform');

        $this->assertDatabaseHas('platform_audit_logs', ['actor_id' => $this->admin->id, 'store_id' => $this->shop->id, 'action' => 'tenant.suspend']);

        $this->asAdmin()->postJson("/api/v1/platform/tenants/{$this->shop->id}/restore")->assertOk()->assertJsonPath('data.status', 'active');
        $this->assertDatabaseHas('platform_audit_logs', ['store_id' => $this->shop->id, 'action' => 'tenant.restore']);
    }

    public function test_a_plan_override_applies_without_payment_and_billing_does_not_undo_a_platform_suspension(): void
    {
        $billing = app(BillingService::class);
        $billing->startTrial($this->shop->organization);

        $this->asAdmin()->postJson("/api/v1/platform/tenants/{$this->shop->id}/plan", ['plan' => 'pro', 'status' => 'active', 'days' => 90])
            ->assertOk()->assertJsonPath('data.plan.key', 'pro')->assertJsonPath('data.subscription_status', 'active');

        $this->assertSame(Subscription::ACTIVE, Subscription::where('organization_id', $this->shop->organization_id)->firstOrFail()->status);
        $this->assertDatabaseHas('platform_audit_logs', ['store_id' => $this->shop->id, 'action' => 'tenant.plan_override']);

        $this->shop->forceFill(['status' => 'suspended', 'suspension_reason' => 'platform'])->save();
        $billing->override($this->shop->organization, Plan::where('key', 'pro')->firstOrFail(), 'active');
        $this->assertSame('suspended', $this->shop->fresh()->status);
    }

    public function test_per_account_overrides_beat_the_plan(): void
    {
        app(BillingService::class)->startTrial($this->shop->organization);
        $starter = Plan::where('key', 'starter')->firstOrFail();
        app(BillingService::class)->override($this->shop->organization, $starter, 'active');

        Product::factory()->count(2)->create(['store_id' => $this->shop->id]);
        $this->asAdmin()->putJson("/api/v1/platform/tenants/{$this->shop->id}/overrides", ['limits' => ['products' => 1], 'features' => ['online_payments' => true]])->assertOk();

        $limits = app(PlanLimits::class);
        $this->assertFalse($limits->canAdd($this->shop->organization->fresh(), 'products'));
        $this->assertTrue($limits->feature($this->shop->organization->fresh(), 'online_payments'));
        $this->assertDatabaseHas('platform_audit_logs', ['store_id' => $this->shop->id, 'action' => 'tenant.overrides']);
    }

    public function test_entering_a_shop_as_support_is_audited_and_flagged(): void
    {
        $this->asAdmin()->postJson('/api/v1/auth/switch-store', ['store_id' => $this->shop->id])->assertOk();

        $this->assertDatabaseHas('platform_audit_logs', ['actor_id' => $this->admin->id, 'store_id' => $this->shop->id, 'action' => 'tenant.enter']);
        $this->asAdmin()->getJson('/api/v1/auth/my-stores')->assertOk()->assertJsonPath('data.support_mode', true);

        // Their own shop is not "support".
        $home = $this->admin->stores()->first();
        $this->asAdmin()->postJson('/api/v1/auth/switch-store', ['store_id' => $home->id])->assertOk();
        $this->asAdmin()->getJson('/api/v1/auth/my-stores')->assertJsonPath('data.support_mode', false);
    }

    public function test_anyone_can_report_a_shop_and_a_report_can_suspend_it(): void
    {
        $this->postJson('/api/v1/abuse-reports', ['reason' => 'fraud', 'details' => 'Took my money', 'url' => 'https://rahim.example/p/1'])->assertCreated();
        $report = AbuseReport::firstOrFail();
        $report->update(['store_id' => $this->shop->id]);

        $this->asAdmin()->getJson('/api/v1/platform/reports')->assertOk()->assertJsonPath('data.0.reason', 'fraud');
        $this->asAdmin()->postJson("/api/v1/platform/reports/{$report->id}/resolve", ['status' => 'actioned', 'suspend_store' => true, 'note' => 'Confirmed'])->assertOk();

        $this->assertSame('suspended', $this->shop->fresh()->status);
        $this->assertSame('actioned', $report->fresh()->status);
        $this->postJson('/api/v1/abuse-reports', ['reason' => 'nonsense'])->assertStatus(422);
    }

    public function test_announcements_reach_merchants_only_while_live(): void
    {
        $this->asAdmin()->postJson('/api/v1/platform/announcements', ['title' => 'Maintenance tonight', 'body' => '2am-3am', 'level' => 'warning'])->assertCreated();
        Announcement::create(['title' => 'Old news', 'body' => '-', 'level' => 'info', 'ends_at' => now()->subDay()]);
        Announcement::create(['title' => 'Switched off', 'body' => '-', 'level' => 'info', 'is_active' => false]);

        $titles = collect($this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/announcements/live')->assertOk()->json('data'))->pluck('title')->all();
        $this->assertSame(['Maintenance tonight'], $titles);

        // Merchants cannot publish.
        $this->actingAs($this->owner, 'sanctum')->postJson('/api/v1/platform/announcements', ['title' => 'x', 'body' => 'y', 'level' => 'info'])->assertForbidden();
    }

    public function test_overview_reports_mrr_and_tenants(): void
    {
        $billing = app(BillingService::class);
        $billing->override($this->shop->organization, Plan::where('key', 'growth')->firstOrFail(), 'active');

        $data = $this->asAdmin()->getJson('/api/v1/platform/overview')->assertOk()->json('data');

        $this->assertSame(2, $data['tenants']['total']);
        $this->assertEquals((float) Plan::where('key', 'growth')->firstOrFail()->priceFor('monthly'), $data['revenue']['mrr']);
        $this->assertSame(1, $data['subscriptions']['active']);
    }

    public function test_audit_log_is_readable_by_admins_only(): void
    {
        PlatformAuditLog::record($this->admin, 'tenant.suspend', $this->shop->id, ['reason' => 'test']);

        $this->asAdmin()->getJson('/api/v1/platform/audit-log')->assertOk()->assertJsonPath('data.0.action', 'tenant.suspend');
        $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/platform/audit-log')->assertForbidden();
    }
}
