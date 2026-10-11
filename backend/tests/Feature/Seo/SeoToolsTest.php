<?php

namespace Tests\Feature\Seo;

use App\Models\NotFoundLog;
use App\Models\Page;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SeoToolsTest extends TestCase
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

    /** @return array<string, mixed> */
    private function draft(array $overrides = []): array
    {
        return array_merge([
            'kind' => 'page',
            'title' => 'Wireless Earbuds Buying Guide: 7 Tips',
            'description' => 'Our wireless earbuds guide explains battery life, fit and sound so you can choose the right pair for your budget and daily routine.',
            'keyword' => 'wireless earbuds',
            'slug' => 'wireless-earbuds-guide',
            'content' => '<p>Wireless earbuds are everywhere. '.str_repeat('Choosing carefully matters because comfort and battery differ a lot between models. ', 30).'</p><h2>Battery</h2><p>Long battery life helps.</p>',
        ], $overrides);
    }

    public function test_a_well_optimised_draft_scores_higher_than_an_empty_one(): void
    {
        $admin = $this->admin();
        $store = Store::factory()->create();

        $good = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/seo/analyze', ['store_id' => $store->id] + $this->draft())
            ->assertOk()
            ->assertJsonStructure(['data' => ['score', 'level', 'tests']])
            ->json('data');

        $empty = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/seo/analyze', ['store_id' => $store->id, 'kind' => 'page'])
            ->assertOk()
            ->json('data');

        $this->assertGreaterThan($empty['score'], $good['score']);
        $this->assertGreaterThanOrEqual(51, $good['score']);
        $this->assertSame('poor', $empty['level']);

        $tests = collect($good['tests'])->keyBy('id');
        $this->assertTrue($tests['keyword_in_title']['passed'] ?? $tests['in_title']['passed']);
    }

    public function test_saving_seo_stores_the_score(): void
    {
        $admin = $this->admin();
        $store = Store::factory()->create();
        $page = Page::factory()->for($store)->create(['title' => 'Returns', 'slug' => 'returns']);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/pages/{$page->id}", [
                'store_id' => $store->id,
                'title' => 'Returns',
                'slug' => 'returns',
                'status' => 'published',
                'seo' => ['title' => 'Returns Policy', 'focus_keyword' => 'returns policy'],
            ])->assertOk();

        $this->assertNotNull($page->fresh()->seoMetadata->score);
    }

    public function test_rescore_updates_stored_scores(): void
    {
        $admin = $this->admin();
        $store = Store::factory()->create();
        $page = Page::factory()->for($store)->create(['title' => 'About']);
        $page->seoMetadata()->create(['store_id' => $store->id, 'title' => 'About us', 'score' => null]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/seo/rescore', ['store_id' => $store->id, 'entities' => ['pages']])
            ->assertOk()
            ->assertJsonPath('data.results.0.rescored', 1);

        $this->assertNotNull($page->fresh()->seoMetadata->score);
    }

    public function test_storefront_404s_are_counted_and_listed(): void
    {
        $store = Store::factory()->create();

        foreach (range(1, 3) as $_) {
            $this->postJson('/api/v1/storefront/seo/not-found', ['path' => '/products/old-thing?utm=x', 'referrer' => 'https://google.com'])
                ->assertOk();
        }
        // Static assets are ignored.
        $this->postJson('/api/v1/storefront/seo/not-found', ['path' => '/images/missing.png'])->assertOk();

        $this->assertSame(1, NotFoundLog::query()->where('store_id', $store->id)->count());
        $this->assertSame(3, NotFoundLog::query()->first()->hits);
        $this->assertSame('/products/old-thing', NotFoundLog::query()->first()->path);

        $this->app['auth']->forgetGuards();

        $this->actingAs($this->admin(), 'sanctum')
            ->getJson("/api/v1/seo/404?store_id={$store->id}")
            ->assertOk()
            ->assertJsonPath('data.0.path', '/products/old-thing')
            ->assertJsonPath('data.0.hits', 3);
    }

    public function test_404_reports_require_the_storefront_key_when_one_is_configured(): void
    {
        $store = Store::factory()->create();
        config(['app.ssr_key' => 'shared-secret']);

        $this->postJson('/api/v1/storefront/seo/not-found', ['path' => '/junk'])->assertOk();
        $this->assertSame(0, NotFoundLog::count());

        $this->withHeaders(['X-Storefront-Key' => 'shared-secret'])
            ->postJson('/api/v1/storefront/seo/not-found', ['path' => '/real-miss'])->assertOk();
        $this->assertSame(1, NotFoundLog::query()->where('store_id', $store->id)->count());
    }

    public function test_404_entries_can_be_removed_and_cleared(): void
    {
        $admin = $this->admin();
        $store = Store::factory()->create();
        $log = NotFoundLog::create(['store_id' => $store->id, 'path' => '/a', 'path_hash' => sha1('/a'), 'hits' => 1, 'first_seen_at' => now(), 'last_seen_at' => now()]);
        NotFoundLog::create(['store_id' => $store->id, 'path' => '/b', 'path_hash' => sha1('/b'), 'hits' => 1, 'first_seen_at' => now(), 'last_seen_at' => now()]);

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/v1/seo/404/{$log->id}?store_id={$store->id}")->assertOk();
        $this->assertSame(1, NotFoundLog::count());

        $this->actingAs($admin, 'sanctum')->deleteJson("/api/v1/seo/404?store_id={$store->id}")->assertOk();
        $this->assertSame(0, NotFoundLog::count());
    }

    public function test_indexnow_needs_a_key_then_submits_site_urls(): void
    {
        Http::fake(['api.indexnow.org/*' => Http::response('', 200)]);

        $admin = $this->admin();
        $store = Store::factory()->create();
        config(['app.frontend_url' => 'https://shop.example.com']);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/seo/indexnow/submit', ['store_id' => $store->id])
            ->assertStatus(422);

        $key = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/seo/indexnow/key', ['store_id' => $store->id])
            ->assertOk()
            ->json('data.key');

        $this->assertMatchesRegularExpression('/^[a-f0-9]{32}$/', $key);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/seo/indexnow/submit', [
                'store_id' => $store->id,
                'urls' => ['/products/one', 'https://elsewhere.test/not-ours'],
            ])
            ->assertOk()
            ->assertJsonPath('data.accepted', true)
            ->assertJsonPath('data.submitted', 1);

        Http::assertSent(fn ($request) => $request['key'] === $key
            && $request['host'] === 'shop.example.com'
            && $request['urlList'] === ['https://shop.example.com/products/one']);
    }

    public function test_seo_tools_are_permission_gated(): void
    {
        $store = Store::factory()->create();

        $this->actingAs(User::factory()->create(), 'sanctum')
            ->getJson("/api/v1/seo/404?store_id={$store->id}")
            ->assertForbidden();
    }
}
