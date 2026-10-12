<?php

namespace Tests\Feature\Catalog;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Support\HtmlSanitizer;
use App\Support\SkuGenerator;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductEditorTest extends TestCase
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

    private function payload(Store $store, array $overrides = []): array
    {
        return $overrides + [
            'store_id' => $store->id,
            'name' => 'Test Cable',
            'slug' => 'test-cable-'.uniqid(),
            'price' => '199.00',
        ];
    }

    public function test_a_blank_sku_is_generated_from_the_brand(): void
    {
        $store = Store::factory()->create();
        $brand = Brand::factory()->for($store)->create(['name' => 'Joyroom']);
        $admin = $this->admin();

        $first = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/products', $this->payload($store, ['brand_id' => $brand->id]))
            ->assertCreated()->json('data.sku');
        $second = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/products', $this->payload($store, ['brand_id' => $brand->id, 'sku' => '']))
            ->assertCreated()->json('data.sku');

        $this->assertSame('JOY-000001', $first);
        $this->assertSame('JOY-000002', $second);
    }

    public function test_a_typed_sku_is_kept_and_a_blank_one_on_update_keeps_the_existing(): void
    {
        $store = Store::factory()->create();
        $admin = $this->admin();

        $id = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/products', $this->payload($store, ['sku' => 'MY-SKU-1']))
            ->assertCreated()->assertJsonPath('data.sku', 'MY-SKU-1')->json('data.id');

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/products/{$id}", $this->payload($store, ['sku' => '', 'name' => 'Renamed']))
            ->assertOk()->assertJsonPath('data.sku', 'MY-SKU-1')->assertJsonPath('data.name', 'Renamed');
    }

    public function test_the_next_sku_preview_matches_what_is_generated(): void
    {
        $store = Store::factory()->create();
        $brand = Brand::factory()->for($store)->create(['name' => 'Anker']);
        Product::factory()->for($store)->create(['sku' => 'ANK-000007']);

        $this->actingAs($this->admin(), 'sanctum')
            ->getJson("/api/v1/products/next-sku?store_id={$store->id}&brand_id={$brand->id}")
            ->assertOk()->assertJsonPath('data.sku', 'ANK-000008');

        $this->assertSame('ANK-000008', SkuGenerator::generate($store->id, 'Anker'));
        $this->assertSame('PRD-000001', SkuGenerator::generate($store->id));
    }

    public function test_description_html_is_sanitised_but_formatting_survives(): void
    {
        $store = Store::factory()->create();

        $html = '<h2 class="x" onclick="evil()">Specs</h2><p>See <a href="https://example.com" target="_blank" onmouseover="x()">the guide</a>'
            .' <a href="javascript:alert(1)">bad</a></p><script>alert(1)</script><img src="/a.png" onerror="x()" alt="pic">'
            .'<ul><li>One</li></ul><iframe src="https://evil.test"></iframe>';

        $description = $this->actingAs($this->admin(), 'sanctum')
            ->postJson('/api/v1/products', $this->payload($store, ['description' => $html]))
            ->assertCreated()->json('data.description');

        $this->assertStringContainsString('<h2 class="x">Specs</h2>', $description);
        $this->assertStringContainsString('href="https://example.com"', $description);
        $this->assertStringContainsString('rel="noopener noreferrer"', $description);
        $this->assertStringContainsString('<ul><li>One</li></ul>', $description);
        $this->assertStringContainsString('<img src="/a.png" alt="pic">', $description);
        $this->assertStringNotContainsString('script', $description);
        $this->assertStringNotContainsString('onclick', $description);
        $this->assertStringNotContainsString('onerror', $description);
        $this->assertStringNotContainsString('javascript:', $description);
        $this->assertStringNotContainsString('iframe', $description);
    }

    public function test_plain_text_descriptions_are_untouched(): void
    {
        $this->assertSame("Line one\nLine two & more", HtmlSanitizer::clean("Line one\nLine two & more"));
        $this->assertNull(HtmlSanitizer::clean(null));
    }
}
