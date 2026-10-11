<?php

namespace Tests\Feature\Seo;

use App\Models\Page;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Support\SeoGenerator;
use App\Support\SeoScorer;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeoSettingsTest extends TestCase
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

    public function test_settings_default_to_a_sensible_configuration(): void
    {
        $store = Store::factory()->create();

        $this->actingAs($this->admin(), 'sanctum')
            ->getJson("/api/v1/seo/settings?store_id={$store->id}")
            ->assertOk()
            ->assertJsonPath('data.settings.robots.mode', 'default')
            ->assertJsonPath('data.settings.sitemap.enabled', true)
            ->assertJsonPath('data.settings.analytics.ga4_id', null);
    }

    public function test_a_group_can_be_saved_without_wiping_the_others(): void
    {
        $admin = $this->admin();
        $store = Store::factory()->create();

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/seo/settings', [
                'store_id' => $store->id,
                'settings' => ['verification' => ['google' => 'abc123-token']],
            ])->assertOk();

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/seo/settings', [
                'store_id' => $store->id,
                'settings' => ['analytics' => ['ga4_id' => 'G-ABCD1234']],
            ])->assertOk()
            ->assertJsonPath('data.settings.verification.google', 'abc123-token')
            ->assertJsonPath('data.settings.analytics.ga4_id', 'G-ABCD1234');
    }

    public function test_tracking_ids_are_validated_before_they_reach_page_source(): void
    {
        $store = Store::factory()->create();

        $this->actingAs($this->admin(), 'sanctum')
            ->putJson('/api/v1/seo/settings', [
                'store_id' => $store->id,
                'settings' => ['analytics' => ['ga4_id' => '<script>alert(1)</script>']],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('settings.analytics.ga4_id');
    }

    public function test_the_public_endpoint_exposes_settings_without_auth(): void
    {
        $store = Store::factory()->create();

        $this->actingAs($this->admin(), 'sanctum')
            ->putJson('/api/v1/seo/settings', [
                'store_id' => $store->id,
                'settings' => ['robots' => ['mode' => 'block_all']],
            ])->assertOk();

        $this->app['auth']->forgetGuards();

        $this->getJson('/api/v1/storefront/seo-settings')
            ->assertOk()
            ->assertJsonPath('data.store_name', $store->name)
            ->assertJsonPath('data.settings.robots.mode', 'block_all');
    }

    public function test_users_without_seo_permission_are_refused(): void
    {
        $store = Store::factory()->create();
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/v1/seo/settings?store_id={$store->id}")
            ->assertForbidden();
    }

    public function test_generated_product_seo_passes_every_checklist_rule(): void
    {
        $store = Store::factory()->create(['name' => 'Acme']);
        $product = Product::factory()->for($store)->create([
            'name' => 'Anker Soundcore Q30 Wireless Noise Cancelling Headphones',
            'description' => 'Hybrid noise cancelling blocks out everyday noise for focused listening. Up to 40 hours of battery life.',
        ]);

        $generated = (new SeoGenerator($store))->for($product);

        $this->assertSame(SeoScorer::RULES, SeoScorer::passed($generated['title'], $generated['description'], $generated['focus_keyword']));
        $this->assertLessThanOrEqual(60, mb_strlen($generated['title']));
        $this->assertLessThanOrEqual(160, mb_strlen($generated['description']));
    }

    public function test_generation_fills_blanks_but_keeps_hand_written_seo(): void
    {
        $admin = $this->admin();
        $store = Store::factory()->create();
        $handWritten = Page::factory()->for($store)->create(['title' => 'Shipping Policy']);
        $handWritten->seoMetadata()->create(['store_id' => $store->id, 'title' => 'My own careful title', 'description' => null]);
        $blank = Page::factory()->for($store)->create(['title' => 'Returns']);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/seo/generate', ['store_id' => $store->id, 'entities' => ['pages']])
            ->assertOk()
            ->assertJsonPath('data.results.0.processed', 2)
            ->assertJsonPath('data.results.0.updated', 2);

        $this->assertSame('My own careful title', $handWritten->fresh()->seoMetadata->title);
        $this->assertNotEmpty($handWritten->fresh()->seoMetadata->description);
        $this->assertNotEmpty($blank->fresh()->seoMetadata->title);
    }

    public function test_the_audit_reports_coverage_and_site_checks(): void
    {
        $admin = $this->admin();
        $store = Store::factory()->create();
        Page::factory()->for($store)->count(2)->create();

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/v1/seo/audit?store_id={$store->id}")
            ->assertOk()
            ->assertJsonPath('data.entities.1.key', 'pages')
            ->assertJsonPath('data.entities.1.total', 2)
            ->assertJsonPath('data.entities.1.with_title', 0)
            ->assertJsonStructure(['data' => ['overall_score', 'site_score', 'content_score', 'checks' => [['id', 'group', 'passed', 'fix']]]]);
    }
}
