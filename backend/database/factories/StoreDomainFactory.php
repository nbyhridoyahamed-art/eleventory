<?php

namespace Database\Factories;

use App\Models\Store;
use App\Models\StoreDomain;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<StoreDomain>
 */
class StoreDomainFactory extends Factory
{
    protected $model = StoreDomain::class;

    public function definition(): array
    {
        return [
            'store_id' => Store::factory(),
            'domain' => fake()->unique()->domainWord().'-'.fake()->unique()->numerify('####').'.example.com',
            'status' => StoreDomain::PENDING,
            'verification_token' => Str::random(40),
            'is_primary' => false,
        ];
    }

    /** An active row always serves its final domain name, even when a test overrides `domain`. */
    public function configure(): static
    {
        return $this->afterMaking(function (StoreDomain $domain) {
            if ($domain->status === StoreDomain::ACTIVE) {
                $domain->active_domain = $domain->domain;
            }
        });
    }

    /** Verified and served. */
    public function active(): static
    {
        return $this->state(fn () => ['status' => StoreDomain::ACTIVE, 'verified_at' => now()]);
    }
}
