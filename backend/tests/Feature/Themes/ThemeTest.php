<?php

namespace Tests\Feature\Themes;

use App\Models\Media;
use App\Models\Plan;
use App\Models\Store;
use App\Models\User;
use App\Services\Billing\BillingService;
use App\Services\Themes\ThemeService;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Phase 9: theme presets and colours, draft/preview/publish, logo, plan gating and the CSS sandbox. */
class ThemeTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        $this->store = Store::factory()->create(['status' => 'active']);
        $this->owner = User::factory()->create(['current_store_id' => $this->store->id]);
        $this->owner->stores()->attach($this->store->id, ['is_owner' => true, 'status' => 'active']);
        $this->owner->assignRole('Super Admin');
    }

    private function config(array $over = []): array
    {
        return array_replace_recursive([
            'preset' => 'midnight', 'colors' => ['nav' => '#0f172a', 'accent' => '#f59e0b'], 'radius' => 'sharp', 'font' => 'system',
            'topbar' => true, 'logo_media_id' => null, 'favicon_media_id' => null, 'custom_css' => null,
        ], $over);
    }

    private function save(array $over = []): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->owner, 'sanctum')->putJson('/api/v1/theme', $this->config($over));
    }

    private function publish(): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($this->owner, 'sanctum')->postJson('/api/v1/theme/publish');
    }

    private function media(?Store $store = null): Media
    {
        return Media::create(['store_id' => ($store ?? $this->store)->id, 'disk' => 'public', 'path' => 'media/logo.png', 'filename' => 'logo.png', 'mime_type' => 'image/png', 'size' => 100]);
    }

    // ---- the public theme -----------------------------------------------------------------------

    public function test_a_shop_without_a_theme_gets_the_standard_look(): void
    {
        $this->getJson('/api/v1/storefront/theme')->assertOk()
            ->assertJsonPath('data.vars', [])->assertJsonPath('data.topbar', true)->assertJsonPath('data.custom_css', null);
    }

    public function test_a_saved_draft_is_invisible_until_published(): void
    {
        $this->save()->assertOk()->assertJsonPath('data.has_unpublished_changes', true);

        $this->getJson('/api/v1/storefront/theme')->assertJsonPath('data.vars', []);

        $this->publish()->assertOk()->assertJsonPath('data.has_unpublished_changes', false);

        $this->getJson('/api/v1/storefront/theme')
            ->assertJsonPath('data.vars.--color-shop-nav', '#0f172a')
            ->assertJsonPath('data.vars.--radius-md', '3px')
            ->assertJsonPath('data.font_stack', ThemeService::FONTS['system']['stack']);
    }

    public function test_the_preview_token_shows_the_draft_and_nothing_else_does(): void
    {
        $this->save(['colors' => ['nav' => '#166534']])->assertOk();
        $token = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/theme')->json('data.preview_token');

        $this->getJson('/api/v1/storefront/theme?preview='.$token)->assertOk()
            ->assertJsonPath('data.vars.--color-shop-nav', '#166534')->assertHeader('Cache-Control', 'no-store, private');

        $this->getJson('/api/v1/storefront/theme?preview=wrong')->assertJsonPath('data.vars', []);
        $this->getJson('/api/v1/storefront/theme?preview=')->assertJsonPath('data.vars', []);
    }

    public function test_publishing_rotates_the_preview_token(): void
    {
        $this->save()->assertOk();
        $old = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/theme')->json('data.preview_token');

        $this->publish()->assertOk();

        $this->assertNotSame($old, $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/theme')->json('data.preview_token'));
        $this->getJson('/api/v1/storefront/theme?preview='.$old)->assertJsonPath('data.vars.--color-shop-nav', '#0f172a'); // published, not a draft
    }

    public function test_discarding_goes_back_to_the_published_theme(): void
    {
        $this->save()->assertOk();
        $this->publish()->assertOk();
        $this->save(['colors' => ['nav' => '#9a3412']])->assertOk()->assertJsonPath('data.has_unpublished_changes', true);

        $this->actingAs($this->owner, 'sanctum')->postJson('/api/v1/theme/discard')->assertOk()
            ->assertJsonPath('data.has_unpublished_changes', false)->assertJsonPath('data.draft.colors.nav', '#0f172a');
    }

    // ---- colours stay readable ------------------------------------------------------------------

    public function test_text_colour_flips_so_it_stays_readable(): void
    {
        $this->save(['colors' => ['nav' => '#ffffff', 'accent' => '#fde68a']])->assertOk();
        $this->publish();

        $vars = $this->getJson('/api/v1/storefront/theme')->json('data.vars');

        $this->assertSame('#0f172a', $vars['--color-shop-on-nav']);
        $this->assertSame('#0f172a', $vars['--color-shop-on-accent']);

        $service = app(ThemeService::class);
        foreach (['#ffffff', '#0f172a', '#ffa800', '#0b3f91', '#e11d48', '#facc15'] as $colour) {
            $on = $service->vars(['colors' => ['nav' => $colour, 'accent' => $colour], 'radius' => 'soft'])['--color-shop-on-nav'];
            $this->assertGreaterThanOrEqual(4.5, $service->contrast($on, $colour), "text on {$colour}");
        }
    }

    public function test_the_brand_ink_colour_is_always_dark_enough_on_white(): void
    {
        $service = app(ThemeService::class);

        foreach (['#fde68a', '#ffff00', '#0b3f91'] as $nav) {
            $ink = $service->vars(['colors' => ['nav' => $nav, 'accent' => '#ffa800'], 'radius' => 'soft'])['--color-shop-ink'];
            $this->assertGreaterThanOrEqual(4.5, $service->contrast($ink, '#ffffff'), "ink for {$nav}");
        }
    }

    public function test_bad_values_are_rejected(): void
    {
        $this->save(['colors' => ['nav' => 'red']])->assertStatus(422)->assertJsonValidationErrors(['colors.nav']);
        $this->save(['colors' => ['accent' => '#12345']])->assertStatus(422);
        $this->save(['font' => 'Comic Sans from evil.com'])->assertStatus(422);
        $this->save(['radius' => '999px'])->assertStatus(422);
        $this->save(['preset' => 'nope'])->assertStatus(422);
    }

    // ---- logo and favicon -------------------------------------------------------------------------

    public function test_logo_shows_on_the_storefront_once_published(): void
    {
        $logo = $this->media();
        $this->save(['logo_media_id' => $logo->id, 'favicon_media_id' => $logo->id])->assertOk();

        $this->getJson('/api/v1/storefront/store')->assertJsonPath('data.logo_url', null);

        $this->publish();

        $this->getJson('/api/v1/storefront/store')->assertJsonPath('data.logo_url', fn ($url) => str_ends_with($url, '/media/logo.png'));
        $this->getJson('/api/v1/storefront/theme')->assertJsonPath('data.favicon_url', fn ($url) => str_ends_with($url, '/media/logo.png'));
    }

    public function test_another_shops_file_cannot_be_used_as_a_logo(): void
    {
        $other = Store::factory()->create(['status' => 'active']);

        $this->save(['logo_media_id' => $this->media($other)->id])->assertStatus(422)->assertJsonValidationErrors(['logo_media_id']);
    }

    // ---- who may change it --------------------------------------------------------------------------

    public function test_only_people_who_manage_settings_may_edit_the_theme(): void
    {
        $this->getJson('/api/v1/theme')->assertUnauthorized();

        $staff = User::factory()->create(['current_store_id' => $this->store->id]);
        $staff->stores()->attach($this->store->id, ['is_owner' => false, 'status' => 'active']);

        $this->actingAs($staff, 'sanctum')->putJson('/api/v1/theme', $this->config())->assertForbidden();
    }

    // ---- plan gating --------------------------------------------------------------------------------

    private function onPlan(string $key): void
    {
        config(['app.saas_mode' => true]);
        app(BillingService::class)->override($this->store->organization, Plan::where('key', $key)->firstOrFail(), 'active');
    }

    public function test_custom_css_needs_a_plan_that_includes_it(): void
    {
        $this->onPlan('starter');

        $this->save(['custom_css' => '.x { color: red; }'])->assertStatus(402)->assertJsonPath('errors.code.0', 'plan_feature_missing');
        $this->save()->assertOk()->assertJsonPath('data.can_custom_css', false); // presets and colours stay free
    }

    public function test_custom_css_is_served_on_growth_and_dropped_if_the_plan_falls_back(): void
    {
        $this->onPlan('growth');
        $this->save(['custom_css' => '.storefront-header { letter-spacing: 0.02em; }'])->assertOk()->assertJsonPath('data.can_custom_css', true);
        $this->publish()->assertOk();

        config(['app.platform_domain' => 'eleventory.test']);
        $host = ['X-Store-Host' => $this->store->slug.'.eleventory.test'];

        $this->getJson('/api/v1/storefront/theme', $host)->assertJsonPath('data.custom_css', '.storefront-header { letter-spacing: 0.02em; }');

        app(BillingService::class)->override($this->store->organization, Plan::where('key', 'starter')->firstOrFail(), 'active');

        $this->getJson('/api/v1/storefront/theme', $host)->assertJsonPath('data.custom_css', null)->assertJsonPath('data.vars.--color-shop-nav', '#0f172a');
    }

    // ---- the CSS sandbox ----------------------------------------------------------------------------

    public static function forbiddenCss(): array
    {
        return [
            'import' => ['@import "https://evil.example/x.css";'],
            'url' => ['.a { background: url(https://evil.example/pixel.gif); }'],
            'url hidden in a comment' => ['.a { background: u/**/rl(https://evil.example/p.gif); }'],
            'url uppercase' => ['.a { background: URL(//evil.example/p.gif); }'],
            'escape tricks' => ['.a { background: u\\72l(//evil.example/p.gif); }'],
            'font face' => ['@font-face { font-family: X; src: local(Arial); }'],
            'charset' => ['@charset "utf-8"; .a{}'],
            'image-set' => ['.a { background: image-set("a.png" 1x); }'],
            'expression' => ['.a { width: expression(alert(1)); }'],
            'javascript' => ['.a { background: javascript:alert(1); }'],
            'break out of style' => ['.a{} </style><script>alert(1)</script>'],
            'moz binding' => ['.a { -moz-binding: x; }'],
            'unclosed comment' => ['.a { color: red; } /* oops'],
            'unbalanced' => ['.a { color: red;'],
            'too big' => [str_repeat('.a { color: red; } ', 1500)],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('forbiddenCss')]
    public function test_dangerous_css_is_refused(string $css): void
    {
        $this->save(['custom_css' => $css])->assertStatus(422)->assertJsonValidationErrors(['custom_css']);
        $this->assertNull($this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/theme')->json('data.draft.custom_css'));
    }

    public function test_ordinary_css_is_accepted_and_comments_are_stripped(): void
    {
        $css = "/* make it pop */\n.storefront-header { letter-spacing: .02em; }\n@media (max-width: 600px) { .storefront-topbar { display: none; } }\n:root { --color-shop-accent: #ff0000; }";

        $this->save(['custom_css' => $css])->assertOk();

        $stored = $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/theme')->json('data.draft.custom_css');
        $this->assertStringNotContainsString('make it pop', $stored);
        $this->assertStringContainsString('@media (max-width: 600px)', $stored);
    }

    // ---- shops stay separate ------------------------------------------------------------------------

    public function test_one_shops_theme_never_reaches_another_shops_visitors(): void
    {
        config(['app.saas_mode' => true, 'app.platform_domain' => 'eleventory.test']);
        $other = Store::factory()->create(['status' => 'active', 'slug' => 'other-shop']);
        $this->store->update(['slug' => 'my-shop']);

        $this->save(['colors' => ['nav' => '#166534']])->assertOk();
        $this->publish()->assertOk();

        $this->getJson('/api/v1/storefront/theme', ['X-Store-Host' => 'my-shop.eleventory.test'])->assertJsonPath('data.vars.--color-shop-nav', '#166534');
        $this->getJson('/api/v1/storefront/theme', ['X-Store-Host' => 'other-shop.eleventory.test'])->assertJsonPath('data.vars', []);

        // And the other shop cannot preview this shop's draft with its token.
        $token = DB::table('store_themes')->where('store_id', $this->store->id)->value('preview_token');
        $this->getJson('/api/v1/storefront/theme?preview='.$token, ['X-Store-Host' => 'other-shop.eleventory.test'])->assertJsonPath('data.vars', []);
    }

    public function test_the_preview_link_points_at_the_shops_own_address(): void
    {
        config(['app.saas_mode' => true, 'app.platform_domain' => 'eleventory.test', 'app.frontend_url' => 'https://eleventory.test']);
        $this->store->update(['slug' => 'my-shop']);

        $this->actingAs($this->owner, 'sanctum')->getJson('/api/v1/theme')->assertJsonPath('data.storefront_url', 'https://my-shop.eleventory.test');
    }
}
