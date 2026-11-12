<?php

namespace Tests\Feature\Compliance;

use App\Models\Brand;
use App\Models\DataExport;
use App\Models\Invoice;
use App\Models\LegalAcceptance;
use App\Models\Organization;
use App\Models\Store;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Billing\BillingService;
use App\Services\Compliance\AccountDeletion;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use ZipArchive;

/** Phase 10: legal acceptance, data export, account deletion with retention, activity log, preflight. */
class ComplianceTest extends TestCase
{
    use RefreshDatabase;

    private Store $a;

    private Store $b;

    private User $owner;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        config(['app.saas_mode' => true, 'billing.gateway' => 'fake', 'compliance.send_emails' => false]);
        Storage::fake('local');

        $this->a = Store::factory()->create(['status' => 'active']);
        $this->b = Store::factory()->create(['status' => 'active']);

        $this->owner = User::factory()->create(['current_store_id' => $this->a->id, 'password' => 'secret-pass-1']);
        $this->owner->stores()->attach($this->a->id, ['is_owner' => true, 'status' => 'active']);
        $this->owner->assignRole('Super Admin');

        $this->staff = User::factory()->create(['current_store_id' => $this->a->id, 'email' => 'staff-a@example.test']);
        $this->staff->stores()->attach($this->a->id, ['is_owner' => false, 'status' => 'active']);
        $this->staff->assignRole('Super Admin');

        app(BillingService::class)->startTrial($this->a->organization);
    }

    private function headers(): array
    {
        return ['X-Store-Id' => (string) $this->a->id];
    }

    private function brand(Store $store, string $name): void
    {
        DB::table('brands')->insert(['uuid' => (string) \Illuminate\Support\Str::uuid(), 'store_id' => $store->id, 'name' => $name, 'slug' => strtolower($name), 'created_at' => now(), 'updated_at' => now()]);
    }

    // ---- legal acceptance & sign-up --------------------------------------------------------

    public function test_signup_records_acceptance_of_every_document(): void
    {
        config(['app.merchant_signup' => true, 'app.platform_domain' => 'eleventory.test']);

        $this->postJson('/api/v1/auth/signup', [
            'name' => 'New Owner', 'email' => 'new.owner@example.test', 'password' => 'long-enough-1', 'password_confirmation' => 'long-enough-1',
            'store_name' => 'Fresh Shop', 'store_slug' => 'fresh-shop', 'accept_terms' => true,
        ])->assertCreated();

        $user = User::where('email', 'new.owner@example.test')->firstOrFail();
        $this->assertEqualsCanonicalizing(['terms', 'privacy', 'dpa'], LegalAcceptance::where('user_id', $user->id)->where('version', config('legal.version'))->pluck('document')->all());
    }

    public function test_invite_codes_close_signup_when_configured(): void
    {
        config(['app.merchant_signup' => true, 'app.signup_invite_codes' => ['BETA-ONE']]);
        $payload = [
            'name' => 'Invitee', 'email' => 'invitee@example.test', 'password' => 'long-enough-1', 'password_confirmation' => 'long-enough-1',
            'store_name' => 'Invited Shop', 'store_slug' => 'invited-shop', 'accept_terms' => true,
        ];

        $this->getJson('/api/v1/auth/signup-options')->assertOk()->assertJsonPath('data.invite_required', true);
        $this->postJson('/api/v1/auth/signup', $payload)->assertUnprocessable()->assertJsonValidationErrors('invite_code');
        $this->postJson('/api/v1/auth/signup', $payload + ['invite_code' => 'wrong'])->assertUnprocessable();
        $this->postJson('/api/v1/auth/signup', $payload + ['invite_code' => ' beta-one '])->assertCreated();
    }

    public function test_a_new_legal_version_asks_people_to_accept_again(): void
    {
        $this->actingAs($this->owner, 'sanctum');
        $this->getJson('/api/v1/auth/legal')->assertOk()->assertJsonCount(3, 'data.pending');

        $this->postJson('/api/v1/auth/legal/accept', [])->assertUnprocessable();
        $this->postJson('/api/v1/auth/legal/accept', ['accept' => true])->assertOk()->assertJsonCount(0, 'data.pending');

        config(['legal.version' => 'next-version']);
        $this->getJson('/api/v1/auth/legal')->assertJsonCount(3, 'data.pending');
        $this->assertSame(3, LegalAcceptance::where('user_id', $this->owner->id)->count(), 'the old acceptances are kept as proof');
    }

    // ---- data export -----------------------------------------------------------------------

    public function test_the_owner_can_export_only_their_own_shops_data_without_secrets(): void
    {
        $this->brand($this->a, 'Acmebrand');
        $this->brand($this->b, 'Otherbrand');
        $this->actingAs($this->owner, 'sanctum');

        $id = $this->withHeaders($this->headers())->postJson('/api/v1/compliance/exports')->assertCreated()->json('data.id');

        $export = DataExport::withoutGlobalScopes()->findOrFail($id);
        $zip = new ZipArchive;
        $this->assertTrue($zip->open(Storage::disk('local')->path($export->path)) === true);

        $brands = (string) $zip->getFromName('brands.csv');
        $this->assertStringContainsString('Acmebrand', $brands);
        $this->assertStringNotContainsString('Otherbrand', $brands);
        $this->assertNotFalse($zip->getFromName('README.txt'));

        // No CSV carries a secret column, and no file mentions the other shop.
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            $header = strtok((string) $zip->getFromIndex($i), "\n");
            $this->assertDoesNotMatchRegularExpression('/password|secret|token|api_key/i', (string) $header, "{$name} exposes a secret column");
        }
        $zip->close();

        $this->withHeaders($this->headers())->get("/api/v1/compliance/exports/{$id}")->assertOk();
    }

    public function test_exports_are_owner_only_rate_limited_and_expire(): void
    {
        $this->actingAs($this->staff, 'sanctum');
        $this->withHeaders($this->headers())->postJson('/api/v1/compliance/exports')->assertForbidden();

        $this->actingAs($this->owner, 'sanctum');
        $id = $this->withHeaders($this->headers())->postJson('/api/v1/compliance/exports')->assertCreated()->json('data.id');
        $this->withHeaders($this->headers())->postJson('/api/v1/compliance/exports')->assertStatus(429);

        // Another shop's owner cannot fetch it.
        $other = User::factory()->create(['current_store_id' => $this->b->id]);
        $other->stores()->attach($this->b->id, ['is_owner' => true, 'status' => 'active']);
        $other->assignRole('Super Admin');
        $this->actingAs($other, 'sanctum');
        $this->withHeaders(['X-Store-Id' => (string) $this->b->id])->get("/api/v1/compliance/exports/{$id}")->assertNotFound();

        // After expiry the file is deleted and the link is dead.
        $this->travel(8)->days();
        $this->artisan('account:purge')->assertSuccessful();
        $this->assertSame('expired', DataExport::withoutGlobalScopes()->find($id)->status);
        $this->actingAs($this->owner, 'sanctum');
        $this->withHeaders($this->headers())->get("/api/v1/compliance/exports/{$id}")->assertNotFound();
    }

    // ---- account deletion ------------------------------------------------------------------

    public function test_deletion_needs_the_password_and_the_store_address_and_takes_the_shop_offline(): void
    {
        $this->actingAs($this->owner, 'sanctum');
        $h = $this->headers();

        $this->withHeaders($h)->postJson('/api/v1/compliance/deletion', ['password' => 'wrong', 'confirm' => $this->a->slug])->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->withHeaders($h)->postJson('/api/v1/compliance/deletion', ['password' => 'secret-pass-1', 'confirm' => 'nope'])->assertUnprocessable()->assertJsonValidationErrors('confirm');
        $this->assertSame('active', $this->a->fresh()->status);

        $this->withHeaders($h)->postJson('/api/v1/compliance/deletion', ['password' => 'secret-pass-1', 'confirm' => $this->a->slug])->assertOk();

        $this->assertSame('suspended', $this->a->fresh()->status);
        $this->assertSame('deletion', $this->a->fresh()->suspension_reason);
        $this->assertNotNull($this->a->organization->fresh()->deletion_requested_at);
        $this->assertTrue((bool) Subscription::where('organization_id', $this->a->organization_id)->value('cancel_at_period_end'));

        // Still able to cancel while the account is closed down.
        $this->withHeaders($h)->deleteJson('/api/v1/compliance/deletion')->assertOk();
        $this->assertSame('active', $this->a->fresh()->status);
        $this->assertNull($this->a->organization->fresh()->deletion_requested_at);
    }

    public function test_a_staff_member_cannot_ask_for_deletion(): void
    {
        $this->actingAs($this->staff, 'sanctum');

        $this->withHeaders($this->headers())->postJson('/api/v1/compliance/deletion', ['password' => 'x', 'confirm' => $this->a->slug])->assertForbidden();
    }

    public function test_nothing_is_purged_inside_the_grace_period_and_everything_after_it(): void
    {
        $this->brand($this->a, 'Acmebrand');
        $this->brand($this->b, 'Otherbrand');
        $orgA = $this->a->organization;
        $invoice = Invoice::create([
            'organization_id' => $orgA->id, 'subscription_id' => Subscription::where('organization_id', $orgA->id)->value('id'),
            'number' => 'INV-TEST-1', 'status' => 'paid', 'amount' => 100, 'currency' => 'BDT', 'description' => 'Test', 'billing_cycle' => 'monthly',
        ]);

        app(AccountDeletion::class)->request($orgA, $this->owner);

        $this->travel(10)->days();
        $this->artisan('account:purge')->assertSuccessful();
        $this->assertDatabaseHas('stores', ['id' => $this->a->id]);
        $this->assertDatabaseHas('brands', ['store_id' => $this->a->id]);

        $this->travel(5)->days(); // 15 days after the request
        $this->artisan('account:purge')->assertSuccessful();

        $this->assertDatabaseMissing('stores', ['id' => $this->a->id]);
        $this->assertDatabaseMissing('brands', ['store_id' => $this->a->id]);
        $this->assertSame(0, DB::table('store_user')->where('store_id', $this->a->id)->count());

        // The other shop is untouched.
        $this->assertDatabaseHas('stores', ['id' => $this->b->id]);
        $this->assertDatabaseHas('brands', ['store_id' => $this->b->id, 'name' => 'Otherbrand']);

        // Accounting records stay; personal details do not.
        $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'number' => 'INV-TEST-1']);
        $orgA = $orgA->fresh();
        $this->assertNotNull($orgA->purged_at);
        $this->assertSame('Deleted account', $orgA->name);
        $this->assertNull($orgA->email);
        $this->assertSame('Deleted user', $this->owner->fresh()->name);
        $this->assertStringEndsWith('@deleted.invalid', $this->owner->fresh()->email);
        $this->assertCount(0, $this->owner->fresh()->tokens);

        // Proof of what was accepted outlives the account.
        $this->assertDatabaseHas('platform_audit_logs', ['action' => 'account.purged']);

        // Running it again is harmless.
        $this->artisan('account:purge')->assertSuccessful();
    }

    public function test_a_closed_account_cannot_be_restored_and_a_user_of_another_shop_is_not_anonymised(): void
    {
        $this->staff->stores()->attach($this->b->id, ['is_owner' => false, 'status' => 'active']);
        $org = $this->a->organization;
        app(AccountDeletion::class)->request($org, $this->owner);
        $this->travel(15)->days();
        $this->artisan('account:purge')->assertSuccessful();

        $this->assertSame('staff-a@example.test', $this->staff->fresh()->email, 'still belongs to shop B');

        $this->expectException(\RuntimeException::class);
        app(AccountDeletion::class)->cancel($org->fresh(), $this->owner);
    }

    // ---- activity log & preflight ----------------------------------------------------------

    public function test_staff_changes_are_written_to_the_activity_log_for_the_owner(): void
    {
        $this->actingAs($this->owner, 'sanctum');
        $h = $this->headers();

        $this->withHeaders($h)->putJson("/api/v1/stores/{$this->a->id}", ['organization_id' => $this->a->organization_id, 'name' => 'Renamed Shop', 'slug' => $this->a->slug])->assertOk();

        $rows = $this->withHeaders($h)->getJson('/api/v1/compliance/activity')->assertOk()->json('data.data');
        $this->assertSame('store.updated', $rows[0]['action']);
        $this->assertSame($this->owner->email, $rows[0]['user']['email']);

        // Another shop's log is not visible.
        $this->assertDatabaseMissing('activity_logs', ['store_id' => $this->b->id]);
    }

    public function test_preflight_runs_and_reports_blocking_problems(): void
    {
        config(['app.debug' => true]);

        $this->artisan('platform:preflight')->expectsOutputToContain('APP_DEBUG is off')->assertFailed();
    }
}
