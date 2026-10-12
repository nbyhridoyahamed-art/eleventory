<?php

namespace Tests\Feature\Analytics;

use App\Models\AnalyticsEvent;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AnalyticsInsightsTest extends TestCase
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

    private function event(Store $store, string $type, string $session, string $at, array $attrs = []): void
    {
        $event = AnalyticsEvent::factory()->for($store)->create(array_merge(['event_type' => $type, 'session_id' => $session], $attrs));
        $event->forceFill(['created_at' => $at])->save();
    }

    public function test_insights_cover_engagement_abandonment_and_sales(): void
    {
        $store = Store::factory()->create();

        // Visitor who bought: 2 page views, add to cart, checkout, purchase (Wed 2026-06-10, 09h).
        $this->event($store, 'page_view', 's-buy', '2026-06-10 09:00:00', ['path' => '/products/earbuds?utm=1']);
        $this->event($store, 'page_view', 's-buy', '2026-06-10 09:02:00', ['path' => '/cart']);
        $this->event($store, 'add_to_cart', 's-buy', '2026-06-10 09:03:00');
        $this->event($store, 'checkout_start', 's-buy', '2026-06-10 09:04:00');
        $this->event($store, 'purchase', 's-buy', '2026-06-10 09:06:00', ['metadata' => ['total_amount' => 1500, 'currency_code' => 'BDT']]);

        // Visitor who abandoned the cart.
        $this->event($store, 'page_view', 's-cart', '2026-06-10 14:00:00', ['path' => '/products/earbuds/']);
        $this->event($store, 'add_to_cart', 's-cart', '2026-06-10 14:01:00');

        // Bounce: single event.
        $this->event($store, 'page_view', 's-bounce', '2026-06-11 20:00:00', ['path' => '/']);

        // Returning: seen before the period.
        $this->event($store, 'page_view', 's-back', '2026-05-20 10:00:00', ['path' => '/']);
        $this->event($store, 'page_view', 's-back', '2026-06-12 10:00:00', ['path' => '/']);
        $this->event($store, 'page_view', 's-back', '2026-06-12 10:01:00', ['path' => '/blog']);

        $data = $this->actingAs($this->admin(), 'sanctum')
            ->getJson("/api/v1/analytics/overview/insights?store_id={$store->id}&date_from=2026-06-01&date_to=2026-06-30")
            ->assertOk()->json('data');

        // 4 sessions in range; one is single-event.
        $this->assertEquals(25.0, $data['engagement']['bounce_rate']);
        $this->assertEquals(25.0, $data['engagement']['returning_visitor_rate']);
        $this->assertEquals(1.5, $data['engagement']['pages_per_session']); // 6 page views / 4 sessions
        $this->assertSame(2, $data['abandonment']['cart_sessions']);
        $this->assertEquals(50.0, $data['abandonment']['cart_abandonment_rate']);
        $this->assertEquals(0.0, $data['abandonment']['checkout_abandonment_rate']);
        $this->assertSame(1, $data['sales']['purchases']);
        $this->assertEquals(1500.0, $data['sales']['revenue']);

        // Query strings and trailing slashes fold into one page.
        $paths = array_column($data['top_pages'], 'views', 'path');
        $this->assertSame(2, $paths['/products/earbuds']);
        $this->assertCount(7, $data['by_weekday']);
        $this->assertCount(24, $data['by_hour']);
    }

    public function test_insights_require_analytics_permission(): void
    {
        $store = Store::factory()->create();

        $this->actingAs(User::factory()->create(), 'sanctum')
            ->getJson("/api/v1/analytics/overview/insights?store_id={$store->id}&date_from=2026-06-01&date_to=2026-06-30")
            ->assertForbidden();
    }
}
