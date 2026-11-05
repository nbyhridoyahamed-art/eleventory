<?php

namespace App\Services\Tenancy;

use App\Models\Category;
use App\Models\Currency;
use App\Models\HomepageBlock;
use App\Models\Organization;
use App\Models\Page;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\HomepageBlockTypes;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Turns "a person with a shop name" into a working store: organization, store,
 * owner membership and role, plus the defaults a shop needs to open its doors
 * (currency, warehouse, standard pages, homepage, a first category).
 *
 * All or nothing: one transaction, so a failure never leaves half a store.
 */
class StoreProvisioner
{
    public function __construct(private readonly TenantContext $tenant) {}

    public function provision(User $owner, string $storeName, string $slug): Store
    {
        return DB::transaction(function () use ($owner, $storeName, $slug) {
            $currency = Currency::firstOrCreate(
                ['code' => 'BDT'],
                ['symbol' => '৳', 'name' => 'Bangladeshi Taka', 'decimal_places' => 2, 'is_default' => true, 'status' => 'active'],
            );

            $organization = Organization::create([
                'name' => $storeName,
                'slug' => $this->uniqueOrganizationSlug($slug),
                'email' => $owner->email,
                'phone' => $owner->phone,
                'status' => 'active',
                'plan' => 'trial',
                'trial_ends_at' => now()->addDays((int) config('app.trial_days', 14)),
            ]);

            $store = Store::create([
                'organization_id' => $organization->id,
                'name' => $storeName,
                'slug' => $slug,
                'default_currency_id' => $currency->id,
                'default_timezone' => 'Asia/Dhaka',
                'default_locale' => 'en',
                'status' => 'active',
            ]);

            $owner->forceFill(['current_store_id' => $store->id])->save();
            $store->users()->syncWithoutDetaching([$owner->id => ['is_owner' => true, 'status' => 'active']]);
            $owner->syncRoles(['Store Owner']);

            // Everything below belongs to the new store, whatever store the caller was acting for.
            $this->tenant->withoutTenancy(fn () => $this->seedDefaults($store, $owner));

            return $store;
        });
    }

    private function seedDefaults(Store $store, User $owner): void
    {
        Warehouse::create([
            'store_id' => $store->id,
            'name' => 'Main Warehouse',
            'code' => 'MAIN',
            'type' => 'main',
            'status' => 'active',
        ]);

        $category = Category::create([
            'store_id' => $store->id,
            'name' => 'General',
            'slug' => 'general',
            'description' => 'Your first category. Rename it or add more from Catalog → Categories.',
            'sort_order' => 0,
            'status' => 'active',
        ]);

        foreach ($this->pages($store->name) as $slug => [$title, $content]) {
            Page::create([
                'store_id' => $store->id,
                'slug' => $slug,
                'title' => $title,
                'content' => $content,
                'status' => 'published',
                'created_by' => $owner->id,
            ]);
        }

        $blocks = [
            [HomepageBlockTypes::TRUST_BADGES, ['heading' => null, 'items' => [
                ['icon' => 'banknote', 'label' => 'Cash on Delivery'],
                ['icon' => 'truck', 'label' => 'Fast Delivery'],
                ['icon' => 'headset', 'label' => 'Friendly Support'],
            ]]],
            [HomepageBlockTypes::CATEGORY_GRID, ['heading' => 'Shop by Category', 'mode' => 'manual', 'limit' => 8, 'category_ids' => [$category->id]]],
            [HomepageBlockTypes::LATEST_PRODUCTS, ['heading' => 'New Arrivals', 'limit' => 8]],
        ];

        foreach ($blocks as $index => [$type, $settings]) {
            HomepageBlock::create([
                'store_id' => $store->id,
                'type' => $type,
                'settings' => $settings,
                'styles' => [],
                'responsive' => [],
                'visibility' => [],
                'animation' => null,
                'sort_order' => $index,
                'is_active' => true,
                'created_by' => $owner->id,
            ]);
        }

        Cache::forget(HomepageBlock::storefrontCacheKey($store->id));
    }

    /** @return array<string, array{0: string, 1: string}> */
    private function pages(string $storeName): array
    {
        return [
            'about-us' => ['About Us', "Welcome to {$storeName}. Tell your customers who you are, what you sell and why they can trust you."],
            'contact-us' => ['Contact Us', "Questions about an order or a product? Reach {$storeName} using the phone number or email on this page. (Edit this page from Content → Pages.)"],
            'shipping-policy' => ['Shipping Policy', 'Describe where you deliver, how long it takes and what it costs. (Edit this page from Content → Pages.)'],
            'return-policy' => ['Return Policy', 'Describe how long customers have to return an item and how refunds work. (Edit this page from Content → Pages.)'],
            'privacy-policy' => ['Privacy Policy', "How {$storeName} collects and uses customer information. Replace this text with your own policy."],
            'terms-and-conditions' => ['Terms & Conditions', "The terms on which {$storeName} sells to its customers. Replace this text with your own terms."],
        ];
    }

    private function uniqueOrganizationSlug(string $slug): string
    {
        $candidate = $slug;

        while (Organization::where('slug', $candidate)->exists()) {
            $candidate = $slug.'-'.Str::lower(Str::random(4));
        }

        return $candidate;
    }
}
