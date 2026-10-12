<?php

namespace Tests\Feature\Mcp;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RemoteMcpTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
    }

    /** @return array{0: User, 1: Store} */
    private function adminWithStore(): array
    {
        $store = Store::factory()->create();
        $user = User::factory()->create(['current_store_id' => $store->id]);
        $user->assignRole('Super Admin');

        return [$user, $store];
    }

    private function rpc(string $url, string $method, array $params = [], int $id = 1, array $headers = [])
    {
        return $this->withHeaders($headers)->postJson($url, ['jsonrpc' => '2.0', 'id' => $id, 'method' => $method, 'params' => $params]);
    }

    public function test_the_connector_url_handshake_and_tool_list(): void
    {
        [$user] = $this->adminWithStore();
        $token = $user->createToken('mcp:Claude', ['*'])->plainTextToken;
        $url = '/mcp/'.rawurlencode($token);

        $init = $this->rpc($url, 'initialize', ['protocolVersion' => '2025-06-18', 'capabilities' => [], 'clientInfo' => ['name' => 'claude', 'version' => '1']])
            ->assertOk()
            ->assertJsonPath('result.serverInfo.name', 'eleventory')
            ->assertJsonPath('result.protocolVersion', '2025-06-18');
        $this->assertStringContainsString('Eleventory', $init->json('result.instructions'));

        // Notifications get an empty 202.
        $this->postJson($url, ['jsonrpc' => '2.0', 'method' => 'notifications/initialized'])->assertStatus(202);

        $tools = $this->rpc($url, 'tools/list')->assertOk()->json('result.tools');
        $names = array_column($tools, 'name');
        $this->assertContains('list_products', $names);
        $this->assertContains('update_product', $names);
        $this->assertGreaterThan(40, count($tools));
    }

    public function test_tools_call_runs_through_the_admin_api(): void
    {
        [$user, $store] = $this->adminWithStore();
        $brand = Brand::factory()->for($store)->create(['name' => 'Joyroom']);
        $token = $user->createToken('mcp:Claude', ['*'])->plainTextToken;
        $url = '/mcp/'.rawurlencode($token);

        // Create via the tool: SKU is generated, description sanitised.
        $created = $this->rpc($url, 'tools/call', ['name' => 'create_product', 'arguments' => [
            'name' => 'Remote Cable', 'price' => 199, 'brand_id' => $brand->id,
            'description' => '<h2>Hi</h2><script>x</script>',
        ]])->assertOk();
        $this->assertFalse($created->json('result.isError') ?? false);
        $product = json_decode($created->json('result.content.0.text'), true);
        $this->assertSame('JOY-000001', $product['sku']);
        $this->assertStringNotContainsString('script', $product['description']);

        // Merge update keeps the untouched fields.
        $updated = json_decode($this->rpc($url, 'tools/call', ['name' => 'update_product', 'arguments' => [
            'product_id' => $product['id'], 'price' => 249,
        ]])->json('result.content.0.text'), true);
        $this->assertEquals(249, $updated['price']);
        $this->assertSame('Remote Cable', $updated['name']);
        $this->assertSame('JOY-000001', $updated['sku']);

        $list = json_decode($this->rpc($url, 'tools/call', ['name' => 'list_products', 'arguments' => ['search' => 'Remote']])->json('result.content.0.text'), true);
        $this->assertCount(1, $list['items']);
        $this->assertSame(1, $list['pagination']['total']);

        $this->assertSame(1, Product::count());
    }

    public function test_read_only_tokens_hide_and_refuse_write_tools(): void
    {
        [$user] = $this->adminWithStore();
        $token = $user->createToken('mcp:Viewer', ['read'])->plainTextToken;
        $url = '/mcp/'.rawurlencode($token);

        $names = array_column($this->rpc($url, 'tools/list')->json('result.tools'), 'name');
        $this->assertContains('list_products', $names);
        $this->assertNotContains('create_product', $names);

        $blocked = $this->rpc($url, 'tools/call', ['name' => 'create_product', 'arguments' => ['name' => 'X', 'price' => 1]])->assertOk();
        $this->assertTrue($blocked->json('result.isError'));
        $this->assertStringContainsString('read-only', $blocked->json('result.content.0.text'));
    }

    public function test_destructive_tools_need_confirmation(): void
    {
        [$user, $store] = $this->adminWithStore();
        $product = Product::factory()->for($store)->create();
        $url = '/mcp/'.rawurlencode($user->createToken('mcp:Claude', ['*'])->plainTextToken);

        $refused = $this->rpc($url, 'tools/call', ['name' => 'delete_product', 'arguments' => ['product_id' => $product->id, 'confirm' => false]]);
        $this->assertTrue($refused->json('result.isError'));
        $this->assertNotNull(Product::find($product->id));

        $this->rpc($url, 'tools/call', ['name' => 'delete_product', 'arguments' => ['product_id' => $product->id, 'confirm' => true]])->assertOk();
        $this->assertNull(Product::find($product->id));
    }

    public function test_bearer_header_works_and_bad_or_wrong_kind_of_tokens_are_refused(): void
    {
        [$user] = $this->adminWithStore();
        $mcp = $user->createToken('mcp:Claude', ['*'])->plainTextToken;
        $login = $user->createToken('api', ['*'])->plainTextToken;

        $this->rpc('/mcp', 'ping', [], 1, ['Authorization' => 'Bearer '.$mcp])->assertOk()->assertJsonPath('id', 1);

        // The test client keeps headers set above; the rest must be unauthenticated.
        $this->flushHeaders();

        // A normal login token must not be usable as a connector credential.
        $this->postJson('/mcp/'.rawurlencode($login), ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'ping'])->assertStatus(401);
        $this->postJson('/mcp/99%7Cdoesnotexist', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'ping'])->assertStatus(401);
        $this->postJson('/mcp', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'ping'])->assertStatus(401);
    }

    public function test_get_is_not_supported(): void
    {
        $this->get('/mcp/1%7Cabc')->assertStatus(405);
        $this->get('/mcp')->assertStatus(405);
    }
}
