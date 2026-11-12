<?php

namespace Tests\Feature\Tenancy;

use App\Models\Brand;
use App\Models\Customer;
use App\Models\Store;
use App\Services\Tenancy\StoreResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 3: in SaaS mode the public storefront serves the store that owns the
 * host the shopper is on (custom domain or {slug}.platform subdomain).
 */
class HostResolutionTest extends TestCase
{
    use RefreshDatabase;

    private Store $a;

    private Store $b;

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.saas_mode' => true, 'app.platform_domain' => 'eleventory.test']);

        $this->a = Store::factory()->create(['name' => 'Alpha Shop', 'slug' => 'alpha', 'domain' => 'alpha-shop.com', 'status' => 'active']);
        $this->b = Store::factory()->create(['name' => 'Beta Shop', 'slug' => 'beta', 'domain' => null, 'status' => 'active']);
    }

    private function asHost(string $host): array
    {
        return ['X-Store-Host' => $host];
    }

    public function test_a_subdomain_resolves_to_its_store(): void
    {
        $this->getJson('/api/v1/storefront/store', $this->asHost('beta.eleventory.test'))
            ->assertOk()->assertJsonPath('data.name', 'Beta Shop');
    }

    public function test_a_custom_domain_resolves_with_or_without_www_port_and_case(): void
    {
        foreach (['alpha-shop.com', 'www.alpha-shop.com', 'ALPHA-SHOP.com:8443', 'alpha-shop.com.'] as $host) {
            $this->getJson('/api/v1/storefront/store', $this->asHost($host))
                ->assertOk()->assertJsonPath('data.name', 'Alpha Shop');
        }
    }

    public function test_the_origin_header_identifies_a_browser_calling_the_api_directly(): void
    {
        $this->getJson('/api/v1/storefront/store', ['Origin' => 'https://alpha-shop.com'])
            ->assertOk()->assertJsonPath('data.name', 'Alpha Shop');
    }

    public function test_each_host_sees_only_its_own_catalogue(): void
    {
        Brand::factory()->for($this->a)->create(['name' => 'Alpha Brand']);
        Brand::factory()->for($this->b)->create(['name' => 'Beta Brand']);

        $this->getJson('/api/v1/storefront/brands', $this->asHost('alpha-shop.com'))
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Alpha Brand');

        $this->getJson('/api/v1/storefront/brands', $this->asHost('beta.eleventory.test'))
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Beta Brand');
    }

    public function test_an_unknown_host_is_a_404_not_some_other_store(): void
    {
        foreach (['nobody.eleventory.test', 'unknown-shop.com', 'a.b.eleventory.test', 'eleventory.test'] as $host) {
            $this->getJson('/api/v1/storefront/store', $this->asHost($host))
                ->assertNotFound()->assertJsonPath('errors.code.0', 'store_not_found');
        }

        // No host at all is just as unknown.
        $this->getJson('/api/v1/storefront/store')->assertNotFound();
    }

    public function test_a_closed_store_is_unavailable_everywhere_it_is_reachable(): void
    {
        $this->b->update(['status' => 'suspended']);

        $this->getJson('/api/v1/storefront/store', $this->asHost('beta.eleventory.test'))
            ->assertStatus(503)->assertJsonPath('errors.code.0', 'store_unavailable');

        $this->getJson('/api/v1/storefront/store', $this->asHost('alpha-shop.com'))->assertOk();
    }

    public function test_a_deleted_store_no_longer_resolves(): void
    {
        $this->b->delete();

        $this->getJson('/api/v1/storefront/store', $this->asHost('beta.eleventory.test'))->assertNotFound();
    }

    public function test_customer_accounts_belong_to_the_store_of_the_host(): void
    {
        $payload = ['name' => 'Rina', 'phone' => '01711111111', 'password' => 'secret-pass-1', 'password_confirmation' => 'secret-pass-1'];

        $this->postJson('/api/v1/account/auth/register', $payload, $this->asHost('beta.eleventory.test'))->assertCreated();

        $this->assertSame($this->b->id, Customer::where('phone', '01711111111')->value('store_id'));

        $login = ['phone' => '01711111111', 'password' => 'secret-pass-1'];

        // Signs in on the shop they registered at, not on the other one.
        $this->postJson('/api/v1/account/auth/login', $login, $this->asHost('beta.eleventory.test'))->assertOk();
        $this->postJson('/api/v1/account/auth/login', $login, $this->asHost('alpha-shop.com'))->assertStatus(422);

        // The same phone number is free on the other store: accounts are per shop.
        $this->postJson('/api/v1/account/auth/register', $payload, $this->asHost('alpha-shop.com'))->assertCreated();
        $this->assertSame(2, Customer::where('phone', '01711111111')->count());
    }

    public function test_single_store_mode_ignores_the_host_entirely(): void
    {
        config(['app.saas_mode' => false]);
        $this->b->delete();

        $this->getJson('/api/v1/storefront/store', $this->asHost('whatever.example'))
            ->assertOk()->assertJsonPath('data.name', 'Alpha Shop');
    }

    public function test_normalise_rejects_junk(): void
    {
        $resolver = app(StoreResolver::class);

        $this->assertNull($resolver->normalise(null));
        $this->assertNull($resolver->normalise('  '));
        $this->assertNull($resolver->normalise('bad host!'));
        $this->assertSame('shop.example.com', $resolver->normalise('https://Shop.Example.com:3000/path?x=1'));
    }
}
