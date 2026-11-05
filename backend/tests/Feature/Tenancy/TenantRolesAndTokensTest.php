<?php

namespace Tests\Feature\Tenancy;

use App\Models\Brand;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * Roles are shared by every store, and connector tokens act as a person:
 * in multi-tenant mode neither may be a way across the store boundary.
 */
class TenantRolesAndTokensTest extends TestCase
{
    use RefreshDatabase;

    private Store $a;

    private Store $b;

    private User $userA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        Role::findOrCreate('Platform Admin', 'web');
        config(['app.saas_mode' => true]);

        $this->a = Store::factory()->create();
        $this->b = Store::factory()->create();
        $this->userA = User::factory()->create(['current_store_id' => $this->a->id]);
        $this->userA->stores()->attach($this->a->id, ['is_owner' => true, 'status' => 'active']);
        $this->userA->assignRole('Super Admin');
    }

    public function test_a_store_cannot_change_what_a_shared_role_means(): void
    {
        $this->actingAs($this->userA, 'sanctum');

        $this->postJson('/api/v1/roles', ['name' => 'Sneaky', 'permissions' => ['products.view']])->assertForbidden();
        $this->deleteJson('/api/v1/roles/'.Role::findByName('Store Owner', 'web')->id)->assertForbidden();
    }

    public function test_single_store_installs_can_still_manage_roles(): void
    {
        config(['app.saas_mode' => false]);
        $this->actingAs($this->userA, 'sanctum');

        $this->postJson('/api/v1/roles', ['name' => 'Packer', 'permissions' => ['products.view']])->assertCreated();
    }

    public function test_a_store_cannot_hand_out_or_see_the_platform_admin_role(): void
    {
        $this->actingAs($this->userA, 'sanctum');

        $names = collect($this->getJson('/api/v1/roles')->assertOk()->json('data'))->pluck('name');
        $this->assertNotContains('Platform Admin', $names);

        $this->postJson('/api/v1/users', [
            'name' => 'New Staff', 'email' => 'new@example.test', 'password' => 'Str0ng!Pass#1', 'password_confirmation' => 'Str0ng!Pass#1',
            'roles' => ['Platform Admin'],
        ])->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'new@example.test']);
    }

    public function test_a_store_owner_cannot_promote_themselves_to_platform_admin(): void
    {
        $this->actingAs($this->userA, 'sanctum');

        $this->putJson('/api/v1/users/'.$this->userA->id, ['name' => $this->userA->name, 'email' => $this->userA->email, 'roles' => ['Super Admin', 'Platform Admin']])
            ->assertForbidden();

        $this->assertFalse($this->userA->fresh()->hasRole('Platform Admin'));
    }

    public function test_a_connection_token_is_pinned_to_the_store_it_was_made_in(): void
    {
        $this->actingAs($this->userA, 'sanctum');

        $this->postJson('/api/v1/mcp/tokens', ['name' => 'Claude', 'mode' => 'read_only'])->assertCreated();

        $abilities = $this->userA->tokens()->latest('id')->first()->abilities;
        $this->assertContains('store:'.$this->a->id, $abilities);
    }

    public function test_a_pinned_connection_keeps_working_in_its_own_store_after_the_user_moves(): void
    {
        // The user also belongs to store B and later switches to it.
        $this->userA->stores()->attach($this->b->id, ['is_owner' => false, 'status' => 'active']);
        Brand::factory()->for($this->a)->create(['name' => 'Alpha Brand']);
        Brand::factory()->for($this->b)->create(['name' => 'Bravo Brand']);

        $token = $this->userA->createToken('mcp:Claude', ['*', 'store:'.$this->a->id])->plainTextToken;
        $this->userA->forceFill(['current_store_id' => $this->b->id])->save();

        $text = $this->postJson('/mcp/'.rawurlencode($token), [
            'jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/call',
            'params' => ['name' => 'list_brands', 'arguments' => []],
        ])->assertOk()->json('result.content.0.text');

        $this->assertStringContainsString('Alpha Brand', $text);
        $this->assertStringNotContainsString('Bravo Brand', $text);
    }
}
