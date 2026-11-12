<?php

namespace Tests\Feature\Tenancy;

use App\Models\Store;
use App\Models\StoreDomain;
use App\Models\User;
use App\Services\Tenancy\DnsChecker;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** DNS answers decided by the test, not the internet. */
class FakeDns extends DnsChecker
{
    /** @var array<string, string[]> */
    public array $txt = [];

    public ?bool $points = null;

    public function txt(string $name): array
    {
        return $this->txt[$name] ?? [];
    }

    public function pointsTo(string $domain, ?string $target, array $ips = []): ?bool
    {
        return $this->points;
    }
}

/**
 * Phase 4: custom domains are claimed in the admin, proven by a DNS TXT record, and only
 * then served. Nobody can route traffic to a domain they have not proven.
 */
class CustomDomainsTest extends TestCase
{
    use RefreshDatabase;

    private Store $a;

    private Store $b;

    private User $ownerA;

    private User $ownerB;

    private FakeDns $dns;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        config(['app.saas_mode' => true, 'app.platform_domain' => 'eleventory.test', 'tenancy.tls_ask_secret' => 's3cret']);

        $this->dns = new FakeDns;
        $this->app->instance(DnsChecker::class, $this->dns);

        $this->a = Store::factory()->create(['name' => 'Alpha', 'slug' => 'alpha', 'domain' => null, 'status' => 'active']);
        $this->b = Store::factory()->create(['name' => 'Beta', 'slug' => 'beta', 'domain' => null, 'status' => 'active']);
        $this->ownerA = $this->memberOf($this->a);
        $this->ownerB = $this->memberOf($this->b);
    }

    private function memberOf(Store $store, string $role = 'Super Admin'): User
    {
        $user = User::factory()->create(['current_store_id' => $store->id]);
        $user->stores()->attach($store->id, ['is_owner' => true, 'status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    private function as(User $user)
    {
        return $this->actingAs($user, 'sanctum');
    }

    private function add(User $user, string $domain)
    {
        return $this->as($user)->postJson('/api/v1/domains', ['domain' => $domain]);
    }

    /** Publish the ownership record for a domain, as its owner would at their DNS host. */
    private function publishTxt(StoreDomain $domain): void
    {
        $this->dns->txt[$domain->txtName()] = [$domain->txtValue()];
    }

    private function resolveHost(string $host)
    {
        return $this->getJson('/api/v1/storefront/store', ['X-Store-Host' => $host]);
    }

    public function test_adding_a_domain_gives_dns_instructions_and_serves_nothing_yet(): void
    {
        $response = $this->add($this->ownerA, 'https://Shop.Example.com/')->assertCreated();

        $response->assertJsonPath('data.domain', 'shop.example.com')
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.verification.name', '_eleventory.shop.example.com');
        $this->assertStringStartsWith('eleventory-verify=', $response->json('data.verification.value'));

        $this->resolveHost('shop.example.com')->assertNotFound();
    }

    public function test_bad_names_are_refused(): void
    {
        foreach (['localhost', 'nodots', '127.0.0.1', 'bad domain.com', 'eleventory.test', 'rival.eleventory.test', '-x.com', 'a..com'] as $bad) {
            $this->add($this->ownerA, $bad)->assertStatus(422)->assertJsonValidationErrors('domain');
        }

        $this->assertSame(0, StoreDomain::withoutGlobalScopes()->count());
    }

    public function test_the_same_domain_twice_and_the_limit_are_refused(): void
    {
        config(['tenancy.max_domains' => 2]);

        $this->add($this->ownerA, 'one.example.com')->assertCreated();
        $this->add($this->ownerA, 'ONE.example.com')->assertStatus(422);
        $this->add($this->ownerA, 'two.example.com')->assertCreated();
        $this->add($this->ownerA, 'three.example.com')->assertStatus(422);
    }

    public function test_without_the_txt_record_the_domain_fails_and_is_not_served(): void
    {
        $id = $this->add($this->ownerA, 'shop.example.com')->json('data.id');

        $this->as($this->ownerA)->postJson("/api/v1/domains/{$id}/verify")
            ->assertOk()->assertJsonPath('data.status', 'failed');

        $this->assertStringContainsString('_eleventory.shop.example.com', StoreDomain::withoutGlobalScopes()->find($id)->last_error);
        $this->resolveHost('shop.example.com')->assertNotFound();
    }

    public function test_a_wrong_token_does_not_verify(): void
    {
        $id = $this->add($this->ownerA, 'shop.example.com')->json('data.id');
        $this->dns->txt['_eleventory.shop.example.com'] = ['eleventory-verify=someone-elses-token'];

        $this->as($this->ownerA)->postJson("/api/v1/domains/{$id}/verify")->assertJsonPath('data.status', 'failed');
    }

    public function test_with_the_txt_record_the_domain_goes_live_as_primary_and_mirrors_to_the_store(): void
    {
        $id = $this->add($this->ownerA, 'shop.example.com')->json('data.id');
        $this->publishTxt(StoreDomain::withoutGlobalScopes()->find($id));

        $this->as($this->ownerA)->postJson("/api/v1/domains/{$id}/verify")
            ->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.is_primary', true);

        $this->assertSame('shop.example.com', $this->a->fresh()->domain);

        foreach (['shop.example.com', 'www.shop.example.com'] as $host) {
            $this->resolveHost($host)->assertOk()->assertJsonPath('data.name', 'Alpha');
        }
    }

    public function test_the_storefront_reports_the_primary_domain_as_canonical(): void
    {
        $this->resolveHost('alpha.eleventory.test')->assertOk()->assertJsonPath('data.canonical_host', null);

        $id = $this->add($this->ownerA, 'shop.example.com')->json('data.id');
        $this->publishTxt(StoreDomain::withoutGlobalScopes()->find($id));
        $this->as($this->ownerA)->postJson("/api/v1/domains/{$id}/verify");

        // Every address of the store now points at the primary one.
        $this->resolveHost('alpha.eleventory.test')->assertOk()->assertJsonPath('data.canonical_host', 'shop.example.com');
        $this->resolveHost('shop.example.com')->assertOk()->assertJsonPath('data.canonical_host', 'shop.example.com');
    }

    public function test_a_pending_claim_cannot_block_the_real_owner_but_an_active_one_does(): void
    {
        // Beta squats the name first, without proof.
        $squat = $this->add($this->ownerB, 'shop.example.com')->assertCreated()->json('data.id');

        // Alpha, the real owner, can still claim and prove it.
        $id = $this->add($this->ownerA, 'shop.example.com')->assertCreated()->json('data.id');
        $this->publishTxt(StoreDomain::withoutGlobalScopes()->find($id));
        $this->as($this->ownerA)->postJson("/api/v1/domains/{$id}/verify")->assertJsonPath('data.status', 'active');

        // Beta's claim can no longer succeed, even if it somehow had the record.
        $this->publishTxt(StoreDomain::withoutGlobalScopes()->find($squat));
        $this->as($this->ownerB)->postJson("/api/v1/domains/{$squat}/verify")->assertJsonPath('data.status', 'failed');
        $this->resolveHost('shop.example.com')->assertJsonPath('data.name', 'Alpha');

        // And nobody can add a domain another store already has live.
        $this->add($this->ownerB, 'www.shop.example.com')->assertStatus(422);
    }

    public function test_a_domain_saved_on_another_store_directly_is_taken(): void
    {
        $this->a->forceFill(['domain' => 'legacy.example.com'])->save();

        $this->add($this->ownerB, 'legacy.example.com')->assertStatus(422);
    }

    public function test_one_store_cannot_see_or_touch_anothers_domains(): void
    {
        $domain = StoreDomain::factory()->for($this->a)->create();

        $this->as($this->ownerB)->postJson("/api/v1/domains/{$domain->id}/verify")->assertNotFound();
        $this->as($this->ownerB)->postJson("/api/v1/domains/{$domain->id}/primary")->assertNotFound();
        $this->as($this->ownerB)->deleteJson("/api/v1/domains/{$domain->id}")->assertNotFound();
        $this->as($this->ownerB)->getJson('/api/v1/domains')->assertOk()->assertJsonCount(0, 'data.domains');

        $this->assertDatabaseHas('store_domains', ['id' => $domain->id]);
    }

    public function test_staff_without_settings_permission_cannot_manage_domains(): void
    {
        $staff = $this->memberOf($this->a, 'Viewer');

        $this->as($staff)->getJson('/api/v1/domains')->assertForbidden();
        $this->add($staff, 'shop.example.com')->assertForbidden();
    }

    public function test_primary_can_be_switched_and_removal_promotes_or_clears(): void
    {
        $one = StoreDomain::factory()->for($this->a)->active()->create(['domain' => 'one.example.com', 'is_primary' => true]);
        $two = StoreDomain::factory()->for($this->a)->active()->create(['domain' => 'two.example.com']);
        $pending = StoreDomain::factory()->for($this->a)->create();

        $this->as($this->ownerA)->postJson("/api/v1/domains/{$pending->id}/primary")->assertStatus(422);

        $this->as($this->ownerA)->postJson("/api/v1/domains/{$two->id}/primary")->assertOk();
        $this->assertSame('two.example.com', $this->a->fresh()->domain);
        $this->assertFalse($one->fresh()->is_primary);

        // Removing the primary hands the role to another connected domain...
        $this->as($this->ownerA)->deleteJson("/api/v1/domains/{$two->id}")->assertOk();
        $this->assertSame('one.example.com', $this->a->fresh()->domain);
        $this->assertTrue($one->fresh()->is_primary);

        // ...and removing the last one clears the store's domain and stops serving it.
        $this->as($this->ownerA)->deleteJson("/api/v1/domains/{$one->id}")->assertOk();
        $this->assertNull($this->a->fresh()->domain);
        $this->resolveHost('one.example.com')->assertNotFound();
    }

    public function test_the_store_update_cannot_set_a_domain_directly(): void
    {
        $this->as($this->ownerA)->putJson("/api/v1/stores/{$this->a->id}", [
            'organization_id' => $this->a->organization_id,
            'name' => 'Alpha',
            'slug' => 'alpha',
            'domain' => 'victim-shop.com',
        ])->assertOk();

        $this->assertNull($this->a->fresh()->domain);
        $this->resolveHost('victim-shop.com')->assertNotFound();
    }

    public function test_tls_ask_only_approves_known_domains_and_needs_the_secret(): void
    {
        StoreDomain::factory()->for($this->a)->active()->create(['domain' => 'shop.example.com', 'is_primary' => true]);
        StoreDomain::factory()->for($this->a)->create(['domain' => 'pending.example.com']);
        $ask = fn (string $domain, string $secret = 's3cret') => $this->get("/api/v1/internal/tls-ask?domain={$domain}&secret={$secret}");

        $ask('shop.example.com')->assertOk();
        $ask('www.shop.example.com')->assertOk();
        $ask('beta.eleventory.test')->assertOk();                  // a store's free address
        $ask('pending.example.com')->assertNotFound();             // not proven yet
        $ask('random-attacker.com')->assertNotFound();
        $ask('shop.example.com', 'wrong')->assertNotFound();
        $this->get('/api/v1/internal/tls-ask?domain=shop.example.com')->assertNotFound();

        $this->b->update(['status' => 'suspended']);
        $ask('beta.eleventory.test')->assertNotFound();

        config(['tenancy.tls_ask_secret' => '']);
        $ask('shop.example.com', '')->assertNotFound();            // no secret configured: refuse everything
    }

    public function test_migration_backfill_keeps_the_live_domain_working(): void
    {
        // A store that already had stores.domain before this feature exists as an active primary domain.
        $store = Store::factory()->create(['domain' => 'live-shop.com', 'status' => 'active']);
        $migration = require database_path('migrations/2026_11_12_100000_create_store_domains_table.php');
        \Illuminate\Support\Facades\Schema::drop('store_domains');
        $migration->up();

        $this->assertDatabaseHas('store_domains', ['store_id' => $store->id, 'domain' => 'live-shop.com', 'status' => 'active', 'is_primary' => 1]);
        $this->resolveHost('live-shop.com')->assertOk();
    }
}
