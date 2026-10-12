<?php

namespace Tests\Feature\Users;

use App\Models\Store;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffStoreScopeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    public function test_a_user_created_from_the_users_screen_gets_the_creators_store(): void
    {
        $store = Store::factory()->create();
        $admin = User::factory()->create(['current_store_id' => $store->id]);
        $admin->assignRole('Super Admin');

        $created = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/users', [
                'name' => 'New Staff',
                'email' => 'staff@example.com',
                'password' => 'a-strong-passw0rd!',
                'password_confirmation' => 'a-strong-passw0rd!',
                'roles' => ['Super Admin'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.current_store_id', $store->id)
            ->json('data');

        $this->assertSame($store->id, User::find($created['id'])->getRawOriginal('current_store_id'));
    }

    public function test_users_without_a_stored_store_fall_back_to_the_first_store(): void
    {
        $first = Store::factory()->create();
        Store::factory()->create();
        $user = User::factory()->create(['current_store_id' => null]);

        $this->assertSame($first->id, $user->current_store_id);
        $this->assertNull($user->getRawOriginal('current_store_id'));
    }

    public function test_the_new_user_can_actually_load_store_data(): void
    {
        $store = Store::factory()->create();
        $staff = User::factory()->create(['current_store_id' => null]);
        $staff->assignRole('Super Admin');

        $me = $this->actingAs($staff, 'sanctum')->getJson('/api/v1/auth/me')->assertOk()->json('data');
        $this->assertSame($store->id, $me['current_store_id'] ?? $me['user']['current_store_id']);
    }
}
