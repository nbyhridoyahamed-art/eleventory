<?php

namespace App\Services\Tenancy;

use App\Models\Store;
use App\Models\StoreDomain;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Adding, proving, promoting and removing a store's custom domains.
 *
 * Ownership is proven with a DNS TXT record, never by typing a name into a form:
 * only an `active` domain routes traffic, and `stores.domain` is just a mirror of
 * the primary active one (so older code that reads it keeps working).
 */
class DomainManager
{
    public function __construct(private DnsChecker $dns, private StoreResolver $resolver) {}

    /** @throws ValidationException */
    public function add(Store $store, string $input): StoreDomain
    {
        $domain = $this->resolver->normalise($input);

        $this->assertValidName($domain, $input);

        if (StoreDomain::withoutGlobalScopes()->where('store_id', $store->id)->where('domain', $domain)->exists()) {
            $this->fail('This domain is already on your store.');
        }

        if (StoreDomain::withoutGlobalScopes()->where('store_id', $store->id)->count() >= (int) config('tenancy.max_domains', 5)) {
            $this->fail('You have reached the limit of '.config('tenancy.max_domains', 5).' domains. Remove one first.');
        }

        app(\App\Services\Billing\PlanLimits::class)->assertCanAdd($store->id, 'custom_domains');

        $this->assertNotTakenByAnotherStore($store, $domain);

        return StoreDomain::withoutGlobalScopes()->create([
            'store_id' => $store->id,
            'domain' => $domain,
            'status' => StoreDomain::PENDING,
            'verification_token' => Str::random(40),
        ]);
    }

    /** Looks for the ownership record; activates the domain when it is there. */
    public function verify(StoreDomain $domain): StoreDomain
    {
        $store = $domain->store()->firstOrFail();
        $found = in_array($domain->txtValue(), $this->dns->txt($domain->txtName()), true);
        $pointsHere = $this->dns->pointsTo($domain->domain, config('tenancy.cname_target') ?: null, config('tenancy.server_ips', []));

        $domain->last_checked_at = now();
        $domain->points_here = $pointsHere;

        if (! $found) {
            $domain->status = $domain->isActive() ? StoreDomain::ACTIVE : StoreDomain::FAILED;
            $domain->last_error = $domain->isActive()
                ? 'The verification record is no longer there. The domain still works; add it back to be safe.'
                : "We could not find the TXT record {$domain->txtName()} yet. DNS changes can take a few hours.";
            $domain->save();

            return $domain;
        }

        if ($domain->isActive()) {
            $domain->last_error = null;
            $domain->save();

            return $domain;
        }

        try {
            DB::transaction(function () use ($domain, $store) {
                // Someone else may have proven this domain first.
                $this->assertNotTakenByAnotherStore($store, $domain->domain);

                $domain->fill([
                    'status' => StoreDomain::ACTIVE,
                    'active_domain' => $domain->domain,
                    'verified_at' => now(),
                    'last_error' => null,
                    'is_primary' => ! StoreDomain::withoutGlobalScopes()->where('store_id', $store->id)->where('is_primary', true)->exists(),
                ])->save();

                $this->syncStoreDomain($store);
            });
        } catch (ValidationException|QueryException $e) {
            $domain->refresh(); // the rolled-back activation must not linger in memory
            $domain->status = StoreDomain::FAILED;
            $domain->last_error = 'This domain is already connected to another store.';
            $domain->save();
        }

        return $domain->refresh();
    }

    public function makePrimary(StoreDomain $domain): StoreDomain
    {
        if (! $domain->isActive()) {
            $this->fail('Only a connected domain can be the primary one.');
        }

        DB::transaction(function () use ($domain) {
            StoreDomain::withoutGlobalScopes()->where('store_id', $domain->store_id)->update(['is_primary' => false]);
            $domain->forceFill(['is_primary' => true])->save();
            $this->syncStoreDomain($domain->store()->firstOrFail());
        });

        return $domain->refresh();
    }

    public function remove(StoreDomain $domain): void
    {
        DB::transaction(function () use ($domain) {
            $store = $domain->store()->firstOrFail();
            $wasPrimary = $domain->is_primary;
            $domain->delete();

            if ($wasPrimary) {
                StoreDomain::withoutGlobalScopes()
                    ->where('store_id', $store->id)->where('status', StoreDomain::ACTIVE)
                    ->orderBy('id')->first()?->forceFill(['is_primary' => true])->save();
            }

            $this->syncStoreDomain($store);
        });
    }

    /** stores.domain mirrors the primary active domain (null when there is none). */
    private function syncStoreDomain(Store $store): void
    {
        $primary = StoreDomain::withoutGlobalScopes()
            ->where('store_id', $store->id)->where('status', StoreDomain::ACTIVE)->where('is_primary', true)
            ->value('domain');

        // Plain query: bypasses model events and keeps updated_at (onboarding uses it as "edited the store").
        DB::table('stores')->where('id', $store->id)->update(['domain' => $primary]);
    }

    /** @throws ValidationException */
    private function assertValidName(?string $domain, string $input): void
    {
        $platform = $this->resolver->normalise(config('app.platform_domain'));

        if ($domain === null
            || strlen($domain) > 253
            || ! preg_match('/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{2,59})$/', $domain)
            || filter_var($domain, FILTER_VALIDATE_IP)) {
            $this->fail("\"{$input}\" is not a valid domain name. Use something like shop.example.com.");
        }

        if ($platform !== null && ($domain === $platform || str_ends_with($domain, '.'.$platform))) {
            $this->fail("Addresses under {$platform} are managed for you; connect a domain you own.");
        }
    }

    /**
     * The same site may be written with or without "www."; either spelling counts as taken
     * if another store has it as an active domain or as its (older) stores.domain.
     *
     * @throws ValidationException
     */
    private function assertNotTakenByAnotherStore(Store $store, string $domain): void
    {
        $variants = $this->resolver->variants($domain);

        $taken = StoreDomain::withoutGlobalScopes()->whereIn('active_domain', $variants)->where('store_id', '!=', $store->id)->exists()
            || Store::query()->whereIn('domain', $variants)->whereKeyNot($store->id)->exists();

        if ($taken) {
            $this->fail('This domain is already connected to another store.');
        }
    }

    /** @throws ValidationException */
    private function fail(string $message): never
    {
        throw ValidationException::withMessages(['domain' => [$message]]);
    }
}
