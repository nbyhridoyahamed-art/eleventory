<?php

namespace Tests\Feature\Auth;

use App\Models\Store;
use App\Models\User;
use App\Notifications\VerifyStaffEmailNotification;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class StaffRegistrationTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'name' => 'New Person',
            'email' => 'new@example.com',
            'password' => 'a-strong-passw0rd',
            'password_confirmation' => 'a-strong-passw0rd',
        ];
    }

    public function test_anyone_can_sign_up_and_gets_a_verification_email_but_no_token(): void
    {
        Notification::fake();

        $this->postJson('/api/v1/auth/register', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.email', 'new@example.com')
            ->assertJsonPath('data.verification_sent', true)
            ->assertJsonMissingPath('data.token');

        $user = User::where('email', 'new@example.com')->firstOrFail();
        $this->assertNull($user->email_verified_at);
        $this->assertSame([], $user->getRoleNames()->all());
        Notification::assertSentTo($user, VerifyStaffEmailNotification::class);
    }

    public function test_an_unverified_account_cannot_sign_in(): void
    {
        Notification::fake();
        $this->postJson('/api/v1/auth/register', $this->payload())->assertCreated();

        $this->postJson('/api/v1/auth/login', ['email' => 'new@example.com', 'password' => 'a-strong-passw0rd'])
            ->assertForbidden()
            ->assertJsonPath('errors.code.0', 'email_unverified');
    }

    public function test_the_signed_link_verifies_the_address_and_allows_sign_in(): void
    {
        Notification::fake();
        $this->postJson('/api/v1/auth/register', $this->payload())->assertCreated();
        $user = User::where('email', 'new@example.com')->firstOrFail();

        $url = URL::temporarySignedRoute('staff.verification.verify', now()->addHour(), [
            'id' => $user->id,
            'hash' => sha1($user->email),
        ]);

        $this->get($url)->assertRedirect(rtrim((string) config('app.frontend_url'), '/').'/login?verified=1');
        $this->assertNotNull($user->fresh()->email_verified_at);

        $this->postJson('/api/v1/auth/login', ['email' => 'new@example.com', 'password' => 'a-strong-passw0rd'])
            ->assertOk()
            ->assertJsonStructure(['data' => ['token', 'user']])
            ->assertJsonPath('data.user.permissions', []);
    }

    public function test_tampered_or_unsigned_links_do_not_verify(): void
    {
        Notification::fake();
        $this->postJson('/api/v1/auth/register', $this->payload())->assertCreated();
        $user = User::where('email', 'new@example.com')->firstOrFail();

        $this->get("/api/v1/auth/verify-email/{$user->id}/".sha1($user->email))->assertForbidden();

        $wrongHash = URL::temporarySignedRoute('staff.verification.verify', now()->addHour(), ['id' => $user->id, 'hash' => sha1('other@example.com')]);
        $this->get($wrongHash)->assertRedirect(rtrim((string) config('app.frontend_url'), '/').'/login?verified=invalid');
        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_an_unsigned_link_is_a_403_json_not_a_500_even_with_debug_off(): void
    {
        config(['app.debug' => false]);

        $this->getJson('/api/v1/auth/verify-email/1/abc')->assertForbidden();
    }

    public function test_resend_answers_the_same_for_unknown_addresses(): void
    {
        Notification::fake();
        $this->postJson('/api/v1/auth/register', $this->payload())->assertCreated();
        $user = User::where('email', 'new@example.com')->firstOrFail();

        $known = $this->postJson('/api/v1/auth/resend-verification', ['email' => 'new@example.com'])->assertOk()->json('message');
        $unknown = $this->postJson('/api/v1/auth/resend-verification', ['email' => 'nobody@example.com'])->assertOk()->json('message');

        $this->assertSame($known, $unknown);
        Notification::assertSentToTimes($user, VerifyStaffEmailNotification::class, 2);
    }

    public function test_registration_can_be_switched_off(): void
    {
        config(['app.staff_registration' => false]);

        $this->postJson('/api/v1/auth/register', $this->payload())->assertForbidden();
        $this->assertDatabaseMissing('users', ['email' => 'new@example.com']);
    }

    public function test_a_registered_user_sees_nothing_until_given_a_role(): void
    {
        $this->seed(RoleAndPermissionSeeder::class);
        $store = Store::factory()->create();
        $stranger = User::factory()->create(['current_store_id' => $store->id, 'email_verified_at' => now()]);

        $this->actingAs($stranger, 'sanctum')->getJson("/api/v1/products?store_id={$store->id}")->assertForbidden();
        $this->actingAs($stranger, 'sanctum')->getJson("/api/v1/customers?store_id={$store->id}")->assertForbidden();
    }

    public function test_the_verification_email_goes_out_through_the_stores_smtp_when_configured(): void
    {
        $store = Store::factory()->create();
        \App\Models\NotificationSetting::create(['store_id' => $store->id, 'data' => \App\Models\NotificationSetting::merge([
            'email' => ['enabled' => true, 'host' => 'smtp.example.com', 'port' => 587, 'from_address' => 'shop@example.com', 'from_name' => 'Shop'],
        ])]);
        $user = User::factory()->create(['current_store_id' => $store->id, 'email_verified_at' => null]);

        $mail = (new VerifyStaffEmailNotification)->toMail($user);

        $this->assertSame('store_smtp', $mail->mailer);
        $this->assertSame('shop@example.com', $mail->from[0]);
    }
}
