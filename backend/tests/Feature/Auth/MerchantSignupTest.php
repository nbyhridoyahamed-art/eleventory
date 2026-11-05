<?php

namespace Tests\Feature\Auth;

use App\Contracts\CaptchaVerifier;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Notifications\VerifyStaffEmailNotification;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class MerchantSignupTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        config(['app.saas_mode' => true, 'app.merchant_signup' => true]);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Rahim Uddin',
            'email' => 'rahim@example.test',
            'phone' => '01712345678',
            'password' => 'Str0ng!Pass#1',
            'password_confirmation' => 'Str0ng!Pass#1',
            'store_name' => 'Rahim Gadgets',
            'store_slug' => 'rahim-gadgets',
            'accept_terms' => true,
        ], $overrides);
    }

    private function verified(string $email): User
    {
        $user = User::where('email', $email)->firstOrFail();
        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }

    public function test_sign_up_is_closed_unless_switched_on(): void
    {
        config(['app.merchant_signup' => false]);

        $this->postJson('/api/v1/auth/signup', $this->payload())->assertForbidden();
        $this->assertDatabaseCount('stores', 0);
    }

    public function test_sign_up_needs_multi_tenant_mode_so_owners_cannot_touch_shared_roles(): void
    {
        config(['app.saas_mode' => false]);

        $this->postJson('/api/v1/auth/signup', $this->payload())->assertForbidden();
        $this->assertDatabaseMissing('users', ['email' => 'rahim@example.test']);
    }

    public function test_it_creates_a_user_organization_and_a_ready_store(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/signup', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.store.slug', 'rahim-gadgets')
            ->assertJsonPath('data.verification_sent', true);

        $user = User::where('email', 'rahim@example.test')->firstOrFail();
        $store = Store::where('slug', 'rahim-gadgets')->firstOrFail();

        $this->assertNull($user->email_verified_at, 'Must verify the address before signing in.');
        Notification::assertSentTo($user, VerifyStaffEmailNotification::class);

        $this->assertSame($store->id, (int) $user->current_store_id);
        $this->assertTrue($user->hasRole('Store Owner'));
        $this->assertDatabaseHas('store_user', ['store_id' => $store->id, 'user_id' => $user->id, 'is_owner' => true, 'status' => 'active']);

        $organization = $store->organization;
        $this->assertSame('trial', $organization->plan);
        $this->assertEqualsWithDelta(14, now()->diffInDays($organization->trial_ends_at, true), 1);

        // The defaults a shop needs to open.
        $this->assertDatabaseHas('warehouses', ['store_id' => $store->id, 'code' => 'MAIN']);
        $this->assertDatabaseHas('categories', ['store_id' => $store->id, 'slug' => 'general']);
        $this->assertSame(6, \DB::table('pages')->where('store_id', $store->id)->count());
        $this->assertSame(3, \DB::table('homepage_blocks')->where('store_id', $store->id)->count());
        $this->assertSame('BDT', $store->currency->code);
    }

    public function test_the_new_owner_signs_in_only_after_verifying_and_sees_only_their_store(): void
    {
        $this->postJson('/api/v1/auth/signup', $this->payload())->assertCreated();
        $this->postJson('/api/v1/auth/signup', $this->payload([
            'email' => 'karim@example.test', 'phone' => '01812345678', 'store_name' => 'Karim Fashion', 'store_slug' => 'karim-fashion',
        ]))->assertCreated();

        $this->postJson('/api/v1/auth/login', ['email' => 'rahim@example.test', 'password' => 'Str0ng!Pass#1'])
            ->assertForbidden()->assertJsonPath('errors.code.0', 'email_unverified');

        $rahim = $this->verified('rahim@example.test');
        $this->postJson('/api/v1/auth/login', ['email' => 'rahim@example.test', 'password' => 'Str0ng!Pass#1'])->assertOk();

        $this->actingAs($rahim, 'sanctum');
        $titles = collect($this->getJson('/api/v1/pages')->assertOk()->json('data'))->pluck('title');
        $this->assertCount(6, $titles);
        $this->assertStringContainsString('Rahim Gadgets', json_encode($this->getJson('/api/v1/pages')->json('data')));
        $this->assertStringNotContainsString('Karim Fashion', json_encode($this->getJson('/api/v1/pages')->json('data')));

        // The other shop is closed to them.
        $karim = Store::where('slug', 'karim-fashion')->firstOrFail();
        $this->withHeader('X-Store-Id', (string) $karim->id)->getJson('/api/v1/pages')->assertForbidden();
    }

    public function test_the_store_address_must_be_valid_free_and_not_reserved(): void
    {
        $this->postJson('/api/v1/auth/signup', $this->payload())->assertCreated();

        foreach (['rahim-gadgets', 'admin', 'www', 'Ab', '-bad-', 'has space', 'double--hyphen', str_repeat('a', 41)] as $slug) {
            $this->getJson('/api/v1/auth/slug-available?slug='.urlencode($slug))
                ->assertOk()->assertJsonPath('data.available', false);
        }

        // And the sign-up itself enforces the same rule.
        $this->postJson('/api/v1/auth/signup', $this->payload(['email' => 'other@example.test', 'phone' => null, 'store_slug' => 'admin']))
            ->assertUnprocessable()->assertJsonValidationErrors('store_slug');
    }

    public function test_sign_up_is_rate_limited_per_address(): void
    {
        for ($i = 1; $i <= 5; $i++) {
            $this->postJson('/api/v1/auth/signup', $this->payload(['email' => "n{$i}@example.test", 'phone' => null, 'store_slug' => "shop-{$i}"]))->assertCreated();
        }

        $this->postJson('/api/v1/auth/signup', $this->payload(['email' => 'n6@example.test', 'phone' => null, 'store_slug' => 'shop-6']))
            ->assertStatus(429);
    }

    public function test_a_deleted_stores_address_stays_taken(): void
    {
        $this->postJson('/api/v1/auth/signup', $this->payload())->assertCreated();
        Store::where('slug', 'rahim-gadgets')->firstOrFail()->delete();

        $this->postJson('/api/v1/auth/signup', $this->payload(['email' => 'second@example.test', 'phone' => null]))
            ->assertUnprocessable()->assertJsonValidationErrors('store_slug');
    }

    public function test_disposable_addresses_duplicates_and_missing_terms_are_refused(): void
    {
        $this->postJson('/api/v1/auth/signup', $this->payload(['email' => 'bot@mailinator.com']))
            ->assertUnprocessable()->assertJsonValidationErrors('email');

        $this->postJson('/api/v1/auth/signup', $this->payload(['accept_terms' => false]))
            ->assertUnprocessable()->assertJsonValidationErrors('accept_terms');

        $this->postJson('/api/v1/auth/signup', $this->payload())->assertCreated();
        $this->postJson('/api/v1/auth/signup', $this->payload(['store_slug' => 'another-shop']))
            ->assertUnprocessable()->assertJsonValidationErrors('email');

        $this->assertSame(1, Store::count());
    }

    public function test_a_failed_captcha_creates_nothing(): void
    {
        $this->app->bind(CaptchaVerifier::class, fn () => new class implements CaptchaVerifier
        {
            public function passes(?string $token, ?string $ip): bool
            {
                return false;
            }
        });

        $this->postJson('/api/v1/auth/signup', $this->payload())->assertUnprocessable();
        $this->assertDatabaseMissing('users', ['email' => 'rahim@example.test']);
        $this->assertSame(0, Store::count());
    }

    public function test_the_form_can_ask_whether_an_address_is_free(): void
    {
        $this->getJson('/api/v1/auth/slug-available?slug=Fresh-Shop')->assertOk()
            ->assertJsonPath('data.available', true)->assertJsonPath('data.slug', 'fresh-shop');

        $this->getJson('/api/v1/auth/slug-available?slug=admin')->assertOk()->assertJsonPath('data.available', false);

        $this->postJson('/api/v1/auth/signup', $this->payload())->assertCreated();
        $this->getJson('/api/v1/auth/slug-available?slug=rahim-gadgets')->assertOk()->assertJsonPath('data.available', false);
    }

    public function test_the_onboarding_checklist_ticks_itself_off(): void
    {
        $this->postJson('/api/v1/auth/signup', $this->payload())->assertCreated();
        $owner = $this->verified('rahim@example.test');
        $this->actingAs($owner, 'sanctum');

        $first = $this->getJson('/api/v1/onboarding')->assertOk();
        $first->assertJsonPath('data.completed', 1); // email verified; nothing else yet
        $first->assertJsonPath('data.total', 4);
        $this->assertGreaterThanOrEqual(13, $first->json('data.trial.days_left'));

        Product::factory()->create(['store_id' => $owner->current_store_id]);

        $this->getJson('/api/v1/onboarding')->assertJsonPath('data.completed', 2);
    }

    public function test_a_person_with_two_stores_can_list_and_switch_between_them(): void
    {
        $this->postJson('/api/v1/auth/signup', $this->payload())->assertCreated();
        $this->postJson('/api/v1/auth/signup', $this->payload([
            'email' => 'karim@example.test', 'phone' => '01812345678', 'store_name' => 'Karim Fashion', 'store_slug' => 'karim-fashion',
        ]))->assertCreated();

        $rahim = $this->verified('rahim@example.test');
        $first = Store::where('slug', 'rahim-gadgets')->firstOrFail();
        $karimStore = Store::where('slug', 'karim-fashion')->firstOrFail();

        // Rahim opens a second shop of his own.
        $second = Store::factory()->create(['name' => 'Rahim Second']);
        $rahim->stores()->attach($second->id, ['is_owner' => true, 'status' => 'active']);

        $this->actingAs($rahim, 'sanctum');

        $names = collect($this->getJson('/api/v1/auth/my-stores')->assertOk()->json('data.stores'))->pluck('name');
        $this->assertEqualsCanonicalizing(['Rahim Gadgets', 'Rahim Second'], $names->all());

        $this->postJson('/api/v1/auth/switch-store', ['store_id' => $second->id])->assertOk();
        $this->assertSame($second->id, (int) $rahim->fresh()->current_store_id);

        // Someone else's shop, and a shop that does not exist, get the same refusal.
        $this->postJson('/api/v1/auth/switch-store', ['store_id' => $karimStore->id])->assertForbidden();
        $this->postJson('/api/v1/auth/switch-store', ['store_id' => 999999])->assertForbidden();
        $this->assertSame($second->id, (int) $rahim->fresh()->current_store_id);
        $this->assertNotSame($first->id, $second->id);
    }
}
