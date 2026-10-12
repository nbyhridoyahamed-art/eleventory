<?php

namespace Tests\Feature\Mcp;

use App\Models\Store;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class McpTokenTest extends TestCase
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

    public function test_a_token_is_created_listed_and_revoked(): void
    {
        $admin = $this->admin();

        $created = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/mcp/tokens', ['name' => 'Claude Desktop', 'mode' => 'read_only'])
            ->assertCreated()
            ->assertJsonPath('data.connection.name', 'Claude Desktop')
            ->assertJsonPath('data.connection.mode', 'read_only')
            ->json('data');

        $this->assertNotEmpty($created['token']);

        $list = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/mcp/tokens')->assertOk()->json('data');
        $this->assertCount(1, $list);
        $this->assertArrayNotHasKey('token', $list[0]);

        $this->actingAs($admin, 'sanctum')->deleteJson('/api/v1/mcp/tokens/'.$created['connection']['id'])->assertOk();
        $this->assertCount(0, $this->actingAs($admin, 'sanctum')->getJson('/api/v1/mcp/tokens')->json('data'));
    }

    public function test_a_read_only_token_can_read_but_not_write(): void
    {
        $admin = $this->admin();
        $store = Store::factory()->create();

        $readOnly = $admin->createToken('mcp:viewer', ['read'])->plainTextToken;
        $full = $admin->createToken('mcp:editor', ['*'])->plainTextToken;

        $this->withToken($readOnly)->getJson("/api/v1/products?store_id={$store->id}")->assertOk();

        $this->withToken($readOnly)
            ->postJson('/api/v1/products', ['store_id' => $store->id, 'name' => 'X', 'slug' => 'x', 'price' => '1'])
            ->assertForbidden()
            ->assertJsonPath('message', 'This connection is read-only.');

        $this->app['auth']->forgetGuards();

        $this->withToken($full)
            ->postJson('/api/v1/products', ['store_id' => $store->id, 'name' => 'X', 'slug' => 'x', 'price' => '1'])
            ->assertCreated();
    }

    public function test_only_users_who_manage_settings_can_issue_tokens(): void
    {
        $this->actingAs(User::factory()->create(), 'sanctum')
            ->postJson('/api/v1/mcp/tokens', ['name' => 'x', 'mode' => 'full'])
            ->assertForbidden();
    }
}
