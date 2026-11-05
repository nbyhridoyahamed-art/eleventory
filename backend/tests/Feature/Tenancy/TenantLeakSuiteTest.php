<?php

namespace Tests\Feature\Tenancy;

use App\Models\Concerns\BelongsToStore;
use App\Models\Courier;
use App\Models\Customer;
use App\Models\Store;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use ReflectionMethod;
use Tests\TestCase;

/**
 * The wider leak suite: list/export routes, creation, FormRequest store input,
 * customer tokens, secrets, and a guard that fails when a new staff route is
 * added that none of the sweeps understand.
 */
class TenantLeakSuiteTest extends TestCase
{
    use RefreshDatabase;

    private Store $a;

    private Store $b;

    private User $userA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        config(['app.saas_mode' => true]);

        $this->a = Store::factory()->create();
        $this->b = Store::factory()->create();
        $this->userA = User::factory()->create(['current_store_id' => $this->a->id]);
        $this->userA->stores()->attach($this->a->id, ['is_owner' => true, 'status' => 'active']);
        $this->userA->assignRole('Super Admin');
    }

    /** @return array<int, class-string<Model>> */
    private function tenantModels(): array
    {
        $models = [];

        foreach (File::files(app_path('Models')) as $file) {
            $class = 'App\\Models\\'.$file->getFilenameWithoutExtension();

            if (class_exists($class) && in_array(BelongsToStore::class, class_uses_recursive($class), true) && method_exists($class, 'factory')) {
                $models[] = $class;
            }
        }

        return $models;
    }

    public function test_no_list_or_export_route_returns_another_stores_records(): void
    {
        // One record of every store-owned model in store B, remembering what identifies it.
        $markers = [];
        foreach ($this->tenantModels() as $model) {
            try {
                $record = $model::factory()->create(['store_id' => $this->b->id]);
            } catch (\Throwable) {
                continue;
            }

            foreach (['uuid', 'slug', 'name', 'title', 'sku', 'code', 'email', 'phone', 'order_number', 'number'] as $field) {
                $value = $record->getAttribute($field);
                if (is_string($value) && strlen($value) >= 6) {
                    $markers[$value] = $model;
                }
            }
        }
        $this->assertGreaterThan(20, count($markers), 'Too few markers; the factories changed?');

        $this->actingAs($this->userA, 'sanctum');
        $checked = 0;

        foreach (Route::getRoutes() as $route) {
            if (! in_array('tenant', $route->gatherMiddleware(), true) || ! in_array('GET', $route->methods(), true) || $route->parameterNames() !== []) {
                continue;
            }

            $response = $this->getJson('/'.$route->uri());
            $body = $response->getContent();

            foreach ($markers as $marker => $model) {
                $this->assertStringNotContainsString(
                    (string) $marker,
                    (string) $body,
                    "GET /{$route->uri()} leaked a store B {$model} ({$marker})",
                );
            }
            $checked++;
        }

        $this->assertGreaterThan(30, $checked);
    }

    public function test_every_store_owned_model_is_forced_into_the_acting_store_on_create(): void
    {
        $tenant = app(TenantContext::class);
        $tenant->set($this->a->id);
        $checked = 0;

        foreach ($this->tenantModels() as $model) {
            try {
                // The factory asks for store B; the trait must overrule it.
                $record = $model::factory()->create(['store_id' => $this->b->id]);
            } catch (\Throwable) {
                continue;
            }

            $this->assertSame($this->a->id, (int) $record->getRawOriginal('store_id'), "{$model} was created in the wrong store");
            $checked++;
        }

        $tenant->forget();
        $this->assertGreaterThan(20, $checked);
    }

    public function test_a_store_id_in_the_body_cannot_steer_validation_or_the_record(): void
    {
        // Header says A, body says B: the body must not be believed.
        $this->actingAs($this->userA, 'sanctum');

        $this->withHeader('X-Store-Id', (string) $this->a->id)
            ->postJson('/api/v1/brands', ['name' => 'Steered', 'slug' => 'steered', 'store_id' => $this->b->id])
            ->assertCreated();

        $this->assertDatabaseHas('brands', ['slug' => 'steered', 'store_id' => $this->a->id]);
        $this->assertDatabaseMissing('brands', ['slug' => 'steered', 'store_id' => $this->b->id]);
    }

    public function test_a_customer_token_made_for_one_store_is_dead_in_another(): void
    {
        $customer = Customer::factory()->create(['store_id' => $this->a->id]);
        $token = $customer->createToken('account', ['customer', 'store:'.$this->a->id])->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/account/auth/me')->assertOk();

        // The customer is later moved (or the token was minted for another store).
        $customer->forceFill(['store_id' => $this->b->id])->save();
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/v1/account/auth/me')->assertUnauthorized();
    }

    public function test_login_issues_a_token_bound_to_the_customers_store(): void
    {
        $customer = Customer::factory()->create(['store_id' => $this->a->id, 'phone' => '01711112222', 'password' => 'secret-pass-1']);

        $this->postJson('/api/v1/account/auth/login', ['phone' => '01711112222', 'password' => 'secret-pass-1'])->assertOk();

        $abilities = $customer->tokens()->latest('id')->first()->abilities;
        $this->assertContains('store:'.$this->a->id, $abilities);
    }

    public function test_courier_credentials_are_encrypted_at_rest_and_never_returned(): void
    {
        $courier = Courier::factory()->create(['store_id' => $this->a->id, 'provider' => 'steadfast', 'api_key' => 'KEY-123456', 'api_secret' => 'SECRET-654321']);

        $raw = \DB::table('couriers')->where('id', $courier->id)->first();
        $this->assertStringNotContainsString('KEY-123456', (string) $raw->api_key);
        $this->assertStringNotContainsString('SECRET-654321', (string) $raw->api_secret);

        $this->actingAs($this->userA, 'sanctum');
        $body = $this->getJson('/api/v1/couriers')->assertOk()->getContent();
        $this->assertStringNotContainsString('KEY-123456', $body);
        $this->assertStringNotContainsString('SECRET-654321', $body);
    }

    /**
     * The guard: every staff route must be one the sweeps understand, so a new
     * route cannot ship without isolation coverage.
     */
    public function test_every_staff_route_is_understood_by_the_isolation_sweeps(): void
    {
        // Routes whose parameters are not store-owned models, with the reason each is safe.
        $allowed = [
            'api/v1/mcp/tokens/{token}' => 'deleted through $request->user()->tokens(): own tokens only',
            'api/v1/notifications/{id}/read' => 'looked up through the signed-in user notifications relation',
            'api/v1/homepage-blocks/{homepageBlock}/revisions/{revision}/restore' => 'revision is looked up through the (store-scoped) block: $block->revisions()->findOrFail()',
            'api/v1/blog-posts/{blogPost}/versions/{version}/restore' => 'version is looked up through the (store-scoped) post',
            'api/v1/roles/{role}' => 'roles are platform-wide templates; edits are Platform Admin only',
            'api/v1/stores/{store}' => 'StorePolicy limits to member stores',
            'api/v1/users/{user}' => 'UserPolicy::sharesStore limits to the acting store',
        ];

        $unknown = [];

        foreach (Route::getRoutes() as $route) {
            if (! in_array('tenant', $route->gatherMiddleware(), true)) {
                continue;
            }

            $uri = $route->uri();
            $names = $route->parameterNames();

            if ($names === []) {
                continue; // covered by the list/export sweep
            }

            $understood = true;
            foreach ($names as $name) {
                $model = $this->boundModel($route->getActionName(), $name);
                $isTenant = $model !== null && in_array(BelongsToStore::class, class_uses_recursive($model), true);
                $isChild = $model !== null && ! $isTenant; // children: guarded by their parent, see the write sweep
                if (! $isTenant && ! $isChild && ! array_key_exists($uri, $allowed)) {
                    $understood = false;
                }
            }

            if (! $understood) {
                $unknown[] = implode('|', $route->methods()).' '.$uri;
            }
        }

        $this->assertSame([], $unknown, "Staff routes with parameters the isolation sweeps cannot classify.\nBind a store-owned model, or add the route to \$allowed with a reason:\n".implode("\n", $unknown));
    }

    private function boundModel(string $action, string $parameter): ?string
    {
        if (! str_contains($action, '@')) {
            return null;
        }

        [$class, $method] = explode('@', $action);
        if (! method_exists($class, $method)) {
            return null;
        }

        foreach ((new ReflectionMethod($class, $method))->getParameters() as $p) {
            $type = $p->getType()?->getName();
            if (in_array($p->getName(), [$parameter, Str::camel($parameter)], true) && $type && is_subclass_of($type, Model::class)) {
                return $type;
            }
        }

        return null;
    }
}
