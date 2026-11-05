<?php

namespace Tests\Feature\Tenancy;

use App\Models\Brand;
use App\Models\Concerns\BelongsToStore;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RoleAndPermissionSeeder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use ReflectionMethod;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * SAAS_MODE confines every staff request to one store the user belongs to.
 * Two stores, one owner each; nobody may see or touch the other's data.
 */
class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    private Store $a;

    private Store $b;

    private User $userA;

    private User $userB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleAndPermissionSeeder::class);
        config(['app.saas_mode' => true]);

        $this->a = Store::factory()->create();
        $this->b = Store::factory()->create();
        $this->userA = $this->memberOf($this->a);
        $this->userB = $this->memberOf($this->b);
    }

    private function memberOf(Store $store, string $role = 'Super Admin'): User
    {
        $user = User::factory()->create(['current_store_id' => $store->id]);
        $user->stores()->attach($store->id, ['is_owner' => true, 'status' => 'active']);
        $user->assignRole($role);

        return $user;
    }

    public function test_the_default_store_is_the_users_own_and_lists_only_its_data(): void
    {
        Brand::factory()->for($this->a)->count(2)->create();
        Brand::factory()->for($this->b)->count(3)->create();

        $this->actingAs($this->userA, 'sanctum')->getJson('/api/v1/brands')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_naming_another_stores_id_is_rejected_not_honoured(): void
    {
        Brand::factory()->for($this->b)->create();

        $this->actingAs($this->userA, 'sanctum')->getJson("/api/v1/brands?store_id={$this->b->id}")->assertForbidden();
        $this->actingAs($this->userA, 'sanctum')->getJson('/api/v1/brands', ['X-Store-Id' => $this->b->id])->assertForbidden();
    }

    public function test_another_stores_records_do_not_exist_for_show_update_and_delete(): void
    {
        $theirs = Brand::factory()->for($this->b)->create();

        $this->actingAs($this->userA, 'sanctum');
        $this->getJson("/api/v1/brands/{$theirs->id}")->assertNotFound();
        $this->putJson("/api/v1/brands/{$theirs->id}", ['name' => 'Hijacked', 'store_id' => $this->a->id])->assertNotFound();
        $this->deleteJson("/api/v1/brands/{$theirs->id}")->assertNotFound();

        $this->assertDatabaseHas('brands', ['id' => $theirs->id, 'store_id' => $this->b->id, 'deleted_at' => null]);
    }

    public function test_a_record_is_always_created_in_the_acting_store(): void
    {
        $this->actingAs($this->userA, 'sanctum')
            ->postJson('/api/v1/brands', ['store_id' => $this->b->id, 'name' => 'Sneaky', 'slug' => 'sneaky'])
            ->assertForbidden();

        $this->actingAs($this->userA, 'sanctum')
            ->postJson('/api/v1/brands', ['store_id' => $this->a->id, 'name' => 'Honest', 'slug' => 'honest'])
            ->assertCreated();

        $this->assertDatabaseHas('brands', ['name' => 'Honest', 'store_id' => $this->a->id]);
        $this->assertDatabaseMissing('brands', ['name' => 'Sneaky']);
    }

    public function test_a_user_who_is_not_a_member_of_any_store_gets_nothing(): void
    {
        $stranger = User::factory()->create(['current_store_id' => $this->a->id]);
        $stranger->assignRole('Super Admin');

        $this->actingAs($stranger, 'sanctum')->getJson('/api/v1/brands')->assertForbidden();
    }

    public function test_a_suspended_membership_is_not_access(): void
    {
        $this->userA->stores()->updateExistingPivot($this->a->id, ['status' => 'suspended']);

        $this->actingAs($this->userA, 'sanctum')->getJson('/api/v1/brands')->assertForbidden();
    }

    public function test_a_platform_admin_may_act_for_any_store(): void
    {
        $platform = User::factory()->create(['current_store_id' => $this->a->id]);
        $platform->assignRole('Super Admin');
        Role::findOrCreate('Platform Admin', 'web');
        $platform->assignRole('Platform Admin');
        Brand::factory()->for($this->b)->count(2)->create();

        $this->actingAs($platform, 'sanctum')->getJson('/api/v1/brands', ['X-Store-Id' => $this->b->id])
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_the_switch_is_off_by_default_so_single_store_installs_are_unchanged(): void
    {
        config(['app.saas_mode' => false]);
        $loner = User::factory()->create(['current_store_id' => $this->a->id]);
        $loner->assignRole('Super Admin');
        Brand::factory()->for($this->a)->create();
        Brand::factory()->for($this->b)->create();

        $this->actingAs($loner, 'sanctum')->getJson('/api/v1/brands')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_the_store_list_only_shows_stores_the_user_belongs_to(): void
    {
        $this->actingAs($this->userA, 'sanctum')->getJson('/api/v1/stores')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $this->a->id);

        $this->actingAs($this->userA, 'sanctum')->getJson("/api/v1/stores/{$this->b->id}")->assertForbidden();
        $this->actingAs($this->userA, 'sanctum')->putJson("/api/v1/stores/{$this->b->id}", ['organization_id' => $this->b->organization_id, 'name' => 'Mine now', 'slug' => 'mine-now'])->assertForbidden();
    }

    public function test_a_tenant_cannot_open_new_stores_or_see_other_stores_staff(): void
    {
        $this->actingAs($this->userA, 'sanctum')->postJson('/api/v1/stores', ['organization_id' => $this->a->organization_id, 'name' => 'Another', 'slug' => 'another'])->assertForbidden();

        $users = $this->actingAs($this->userA, 'sanctum')->getJson('/api/v1/users')->assertOk()->json('data');
        $this->assertSame([$this->userA->id], array_column($users, 'id'));

        $this->actingAs($this->userA, 'sanctum')->getJson("/api/v1/users/{$this->userB->id}")->assertForbidden();
        $this->actingAs($this->userA, 'sanctum')->deleteJson("/api/v1/users/{$this->userB->id}")->assertForbidden();
    }

    public function test_staff_created_from_the_users_screen_join_the_creators_store(): void
    {
        $this->actingAs($this->userA, 'sanctum')->postJson('/api/v1/users', [
            'name' => 'New Hire', 'email' => 'hire@example.com',
            'password' => 'a-strong-passw0rd', 'password_confirmation' => 'a-strong-passw0rd',
        ])->assertCreated();

        $hire = User::where('email', 'hire@example.com')->firstOrFail();
        $this->assertTrue($hire->canAccessStore($this->a->id));
        $this->assertFalse($hire->canAccessStore($this->b->id));
    }

    /**
     * The sweep: every single-parameter staff route whose parameter is a
     * store-owned model must answer 404 for a record belonging to another
     * store. A new route added without isolation fails here automatically.
     */
    public function test_no_staff_route_can_reach_another_stores_record(): void
    {
        $this->actingAs($this->userA, 'sanctum');
        $checked = 0;
        $notCovered = [];

        foreach (Route::getRoutes() as $route) {
            if (! in_array('tenant', $route->gatherMiddleware(), true) || ! in_array('GET', $route->methods(), true)) {
                continue;
            }

            $names = $route->parameterNames();
            if (count($names) !== 1) {
                continue;
            }

            $model = $this->boundModel($route->getActionName(), $names[0]);
            if ($model === null || ! in_array(BelongsToStore::class, class_uses_recursive($model), true)) {
                continue;
            }

            if (! method_exists($model, 'factory')) {
                $notCovered[] = $route->uri();

                continue;
            }

            try {
                $theirs = $model::factory()->create(['store_id' => $this->b->id]);
            } catch (\Throwable) {
                $notCovered[] = $route->uri();

                continue;
            }

            $uri = str_replace('{'.$names[0].'}', (string) $theirs->getRouteKey(), '/'.$route->uri());
            $this->getJson($uri)->assertNotFound("{$uri} exposed another store's {$model}");
            $checked++;
        }

        $this->assertGreaterThan(10, $checked, 'The sweep found too few routes; the discovery logic is broken.');
        fwrite(STDERR, "\n[tenancy sweep] verified {$checked} routes; no factory for: ".implode(', ', $notCovered)."\n");
    }

    /**
     * The wider sweep: every staff route, whatever its verb, whose first
     * parameter is a store-owned model must 404 for another store's record
     * (writes included: update, delete, approve, ship ...), and for nested
     * routes the same holds when only the second parameter is foreign.
     */
    public function test_no_write_or_nested_route_can_reach_another_stores_record(): void
    {
        $this->actingAs($this->userA, 'sanctum');
        $checked = 0;
        $skipped = [];

        foreach (Route::getRoutes() as $route) {
            if (! in_array('tenant', $route->gatherMiddleware(), true)) {
                continue;
            }

            $names = $route->parameterNames();
            if ($names === []) {
                continue;
            }

            $verb = array_values(array_diff($route->methods(), ['HEAD']))[0];
            $models = array_map(fn ($n) => $this->boundModel($route->getActionName(), $n), $names);

            // Which positions we can plant a foreign record in.
            foreach ($names as $i => $name) {
                $model = $models[$i];
                if ($model === null || ! in_array(BelongsToStore::class, class_uses_recursive($model), true)) {
                    continue;
                }

                if (! method_exists($model, 'factory')) {
                    $skipped[] = $verb.' '.$route->uri();

                    continue;
                }

                try {
                    $theirs = $model::factory()->create(['store_id' => $this->b->id]);
                } catch (\Throwable) {
                    $skipped[] = $verb.' '.$route->uri();

                    continue;
                }

                // Every other parameter gets a record of the acting store when we can make one.
                $uri = '/'.$route->uri();
                $buildable = true;
                foreach ($names as $j => $other) {
                    if ($j === $i) {
                        $value = $theirs->getRouteKey();
                    } elseif ($j < $i && $models[$j] !== null && method_exists($models[$j], 'factory')) {
                        try {
                            $value = $models[$j]::factory()->create(
                                in_array(BelongsToStore::class, class_uses_recursive($models[$j]), true) ? ['store_id' => $this->a->id] : [],
                            )->getRouteKey();
                        } catch (\Throwable) {
                            $buildable = false;
                            break;
                        }
                    } else {
                        $value = 999999;
                    }
                    $uri = str_replace('{'.$other.'}', (string) $value, $uri);
                    $uri = str_replace('{'.$other.'?}', (string) $value, $uri);
                }

                if (! $buildable) {
                    $skipped[] = $verb.' '.$route->uri();

                    continue;
                }

                $response = $this->json($verb, $uri, []);
                $this->assertContains(
                    $response->getStatusCode(),
                    [403, 404],
                    "{$verb} {$uri} reached another store's {$model} (HTTP {$response->getStatusCode()})",
                );
                $this->assertDatabaseHas((new $model)->getTable(), [$theirs->getKeyName() => $theirs->getKey()]);
                $checked++;
            }
        }

        $this->assertGreaterThan(40, $checked, 'The sweep found too few routes; the discovery logic is broken.');
        fwrite(STDERR, "
[tenancy write sweep] verified {$checked} route positions; skipped: ".count($skipped)."
".implode("
", array_slice(array_unique($skipped), 0, 40))."
");
    }

    /** @return class-string<Model>|null */
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
            if ($p->getName() === $parameter && $type && is_subclass_of($type, Model::class)) {
                return $type;
            }
        }

        return null;
    }
}
