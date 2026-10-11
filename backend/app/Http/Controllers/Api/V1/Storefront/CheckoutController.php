<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Requests\Storefront\CheckoutRequest;
use App\Http\Resources\Storefront\OrderResource;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockLevel;
use App\Models\Store;
use App\Models\User;
use App\Models\Warehouse;
use App\Notifications\NewOrderPlacedNotification;
use App\Notifications\OrderPlacedNotification;
use App\Support\ApiResponse;
use App\Support\BundleExpander;
use App\Support\CouponException;
use App\Support\CouponResolver;
use App\Support\DeliveryRateResolver;
use App\Support\InsufficientStockException;
use App\Support\Money;
use App\Support\OrderPlacement;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Support\SafeNotification;
use Illuminate\Support\Str;

class CheckoutController extends StorefrontController
{
    private const RELATIONS = [
        'items.product', 'items.productVariant.attributeValues.attribute',
        'shippingDivision', 'shippingDistrict', 'shippingUpazila', 'couponUsage',
    ];

    public function store(CheckoutRequest $request): JsonResponse
    {
        $store = $this->currentStore();
        $data = $request->validated();

        $resolved = $this->resolveItems($store, $data['items']);

        if ($resolved instanceof JsonResponse) {
            return $resolved;
        }

        $warehouse = $this->selectWarehouse($store, $resolved);

        if (! $warehouse) {
            return ApiResponse::error('Sorry, one or more items in your cart are currently out of stock.', [], 422);
        }

        $currency = $resolved[0]['product']->currency_code;
        $subtotalMinor = array_sum(array_map(
            fn (array $item) => $item['quantity'] * Money::fromDecimal($item['unit_price'], $currency)->amountMinor,
            $resolved,
        ));

        try {
            $order = DB::transaction(function () use ($store, $data, $resolved, $warehouse, $currency, $subtotalMinor) {
                // Reused across repeat guest orders by phone number — never
                // overwritten with a new name/email on an existing match, so
                // typing someone else's real phone can't rewrite their record.
                $customer = Customer::firstOrCreate(
                    ['store_id' => $store->id, 'phone' => $data['customer_phone']],
                    ['name' => $data['customer_name'], 'email' => $data['customer_email'] ?? null],
                );

                $coupon = null;
                $discountMinor = 0;

                if (! empty($data['coupon_code'])) {
                    $resolvedCoupon = CouponResolver::resolve($store->id, $data['coupon_code'], $subtotalMinor, $customer->id);
                    $coupon = $resolvedCoupon['coupon'];
                    $discountMinor = $resolvedCoupon['discount_amount'];
                }

                // Falls back to free shipping (Wave 1's behavior) when the
                // store hasn't configured any delivery zones yet — charging
                // real shipping is opt-in by configuration, not a breaking
                // change for a store that never set one up.
                $shippingResolved = DeliveryRateResolver::resolve(
                    $store->id,
                    $data['shipping_bd_division_id'] ?? null,
                    $data['shipping_bd_district_id'] ?? null,
                    $subtotalMinor,
                );

                $order = Order::create([
                    'store_id' => $store->id,
                    'order_number' => 'ORD-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
                    'customer_id' => $customer->id,
                    'warehouse_id' => $warehouse->id,
                    'status' => 'pending',
                    'payment_method' => 'cod',
                    'source' => 'storefront',
                    'currency_code' => $currency,
                    'shipping_amount' => $shippingResolved['rate_amount'] ?? 0,
                    'discount_amount' => $discountMinor,
                    // Redemption is admin-only (see StoreCreditResolver) —
                    // explicit 0 rather than relying on the column default,
                    // since Order::create()'s in-memory model won't reflect
                    // a DB-only default until the row is re-fetched.
                    'store_credit_amount' => 0,
                    'customer_address_id' => null,
                    'shipping_recipient_name' => $data['shipping_recipient_name'],
                    'shipping_phone' => $data['shipping_phone'],
                    'shipping_address_line' => $data['shipping_address_line'],
                    'shipping_bd_division_id' => $data['shipping_bd_division_id'] ?? null,
                    'shipping_bd_district_id' => $data['shipping_bd_district_id'] ?? null,
                    'shipping_bd_upazila_id' => $data['shipping_bd_upazila_id'] ?? null,
                    'notes' => $data['notes'] ?? null,
                    'created_by' => null,
                ]);

                if ($coupon) {
                    CouponResolver::recordUsage($coupon, $order, $discountMinor);
                }

                $items = array_map(fn (array $item) => [
                    'product_id' => $item['product']->id,
                    'product_variant_id' => $item['variant']?->id,
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                ], $resolved);

                OrderPlacement::syncItems($order, $items, $currency);
                OrderPlacement::reserveItems($order);

                $order->statusHistory()->create([
                    'from_status' => null,
                    'to_status' => 'pending',
                    'created_by' => null,
                ]);

                return $order;
            });
        } catch (InsufficientStockException|CouponException $exception) {
            return ApiResponse::error($exception->getMessage(), [], 422);
        }

        SafeNotification::send($order->customer, new OrderPlacedNotification($order));
        SafeNotification::send($this->staffToNotify($store), new NewOrderPlacedNotification($order));

        return ApiResponse::success(
            new OrderResource($order->load(self::RELATIONS)),
            'Order placed successfully.',
            status: 201,
        );
    }

    /**
     * Staff currently working in this store who can see orders — a guest
     * checkout is the one case staff wouldn't otherwise know about until
     * they refresh the Orders list, unlike an admin-created order the
     * acting staff member already knows about. Small-scale filter (active
     * users only), fine at Wave 1's staff-count scale.
     */
    private function staffToNotify(Store $store)
    {
        return User::query()
            ->where('current_store_id', $store->id)
            ->where('status', 'active')
            ->get()
            ->filter(fn (User $user) => $user->can('orders.view'));
    }

    public function show(string $uuid): JsonResponse
    {
        $order = Order::query()->where('uuid', $uuid)->with(self::RELATIONS)->firstOrFail();

        return ApiResponse::success(new OrderResource($order), 'Order fetched successfully.');
    }

    /**
     * Resolves and prices every cart line against the current catalog.
     * There is no client-submitted price anywhere in this request (see
     * CheckoutRequest) — the effective price is always derived here from
     * the product/variant's own price/sale_price columns, field-by-field,
     * the same fallback VariantResource uses to decide what a shopper sees
     * on the PDP, so the charged price always matches the displayed one.
     *
     * @return array<int, array{product: Product, variant: ?ProductVariant, quantity: int, unit_price: float}>|JsonResponse
     */
    private function resolveItems(Store $store, array $items): array|JsonResponse
    {
        $resolved = [];

        foreach ($items as $item) {
            $product = Product::query()
                ->where('id', $item['product_id'])
                ->where('store_id', $store->id)
                ->where('status', 'active')
                ->first();

            if (! $product) {
                return ApiResponse::error('One or more items in your cart are no longer available.', [], 422);
            }

            $variant = null;

            if (! empty($item['product_variant_id'])) {
                $variant = ProductVariant::query()
                    ->where('id', $item['product_variant_id'])
                    ->where('product_id', $product->id)
                    ->where('status', 'active')
                    ->first();

                if (! $variant) {
                    return ApiResponse::error('One or more items in your cart are no longer available.', [], 422);
                }
            }

            $effectivePrice = $variant?->price_amount ?? $product->price_amount;
            $effectiveSalePrice = $variant?->sale_price_amount ?? $product->sale_price_amount;

            $resolved[] = [
                'product' => $product,
                'variant' => $variant,
                'quantity' => (int) $item['quantity'],
                'unit_price' => (new Money($effectiveSalePrice ?? $effectivePrice, $product->currency_code))->toDecimal(),
            ];
        }

        return $resolved;
    }

    /**
     * The first active warehouse (lowest id) that can fully cover every
     * resolved line's expanded stock requirement. Wave 1 keeps this to a
     * single warehouse per order — no splitting one order's fulfilment
     * across warehouses — which is what the admin flow already assumes for
     * every other order too, so this isn't a new limitation the storefront
     * invents on its own.
     */
    private function selectWarehouse(Store $store, array $resolved): ?Warehouse
    {
        $requirements = [];

        foreach ($resolved as $item) {
            foreach (BundleExpander::expand($item['product']->id, $item['variant']?->id, $item['quantity']) as $component) {
                $key = $component->product_id.':'.($component->product_variant_id ?? '0');
                $requirements[$key]['product_id'] ??= $component->product_id;
                $requirements[$key]['product_variant_id'] ??= $component->product_variant_id;
                $requirements[$key]['quantity'] = ($requirements[$key]['quantity'] ?? 0) + $component->quantity;
            }
        }

        $warehouses = Warehouse::query()
            ->where('store_id', $store->id)
            ->where('status', 'active')
            ->orderBy('id')
            ->get();

        foreach ($warehouses as $warehouse) {
            $sufficient = collect($requirements)->every(function (array $requirement) use ($warehouse) {
                $level = StockLevel::query()
                    ->where('product_id', $requirement['product_id'])
                    ->where('product_variant_id', $requirement['product_variant_id'])
                    ->where('warehouse_id', $warehouse->id)
                    ->first();

                return (($level?->quantity ?? 0) - ($level?->quantity_reserved ?? 0)) >= $requirement['quantity'];
            });

            if ($sufficient) {
                return $warehouse;
            }
        }

        return null;
    }
}
