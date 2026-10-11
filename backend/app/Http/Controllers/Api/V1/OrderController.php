<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Order\OrderRequest;
use App\Http\Resources\OrderResource;
use App\Models\Coupon;
use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\Product;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Notifications\OrderPlacedNotification;
use App\Notifications\OrderStatusChangedNotification;
use App\Support\ApiResponse;
use App\Support\CouponException;
use App\Support\CouponResolver;
use App\Support\InsufficientStockException;
use App\Support\Money;
use App\Support\OrderPlacement;
use App\Support\StoreCreditException;
use App\Support\StoreCreditResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Support\SafeNotification;
use Illuminate\Support\Str;

class OrderController extends Controller
{
    // Same reasoning as PurchaseOrderController::RELATIONS — every response
    // representing "an order" loads the same relations so a frontend cache
    // write from any action (place/ship/cancel/...) never drops a field the
    // show() response always includes.
    private const RELATIONS = [
        'customer', 'warehouse', 'items.product', 'items.productVariant.attributeValues.attribute', 'creator',
        'items.components.product', 'items.components.productVariant',
        'shippingDivision', 'shippingDistrict', 'shippingUpazila', 'statusHistory.creator',
        'shipments.courier', 'returns', 'payments.creator', 'couponUsage', 'sourceReturn',
    ];

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Order::class);

        $perPage = min((int) $request->integer('per_page', 20), 100);

        $orders = Order::query()
            ->with(self::RELATIONS)
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->boolean('open'), fn ($query) => $query->whereIn('status', ['pending', 'processing']))
            ->when($request->filled('customer_id'), fn ($query) => $query->where('customer_id', $request->integer('customer_id')))
            ->when($request->filled('warehouse_id'), fn ($query) => $query->where('warehouse_id', $request->integer('warehouse_id')))
            ->latest()
            ->paginate($perPage);

        return ApiResponse::success(
            OrderResource::collection($orders),
            'Orders fetched successfully.',
            [
                'current_page' => $orders->currentPage(),
                'per_page' => $orders->perPage(),
                'total' => $orders->total(),
                'last_page' => $orders->lastPage(),
            ],
        );
    }

    public function store(OrderRequest $request): JsonResponse
    {
        $this->authorize('create', Order::class);

        $data = $request->validated();
        $currency = $data['currency_code'] ?? 'BDT';
        $shipping = $this->resolveShipping($data);
        $subtotalMinor = $this->subtotalMinor($data['items'], $currency);
        $shippingMinor = Money::fromDecimal($data['shipping_amount'] ?? 0, $currency)->amountMinor;

        try {
            $order = DB::transaction(function () use ($data, $currency, $shipping, $subtotalMinor, $shippingMinor, $request) {
                $discount = $this->resolveDiscount($data, $currency, $subtotalMinor, $data['customer_id']);
                $storeCreditMinor = StoreCreditResolver::resolve(
                    $data['customer_id'],
                    $data['store_credit_amount'] ?? null,
                    $currency,
                    max(0, $subtotalMinor + $shippingMinor - $discount['amount_minor']),
                );

                $order = Order::create([
                    'store_id' => $data['store_id'],
                    'order_number' => 'ORD-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
                    'customer_id' => $data['customer_id'],
                    'warehouse_id' => $data['warehouse_id'],
                    'status' => 'pending',
                    'payment_method' => $data['payment_method'],
                    'source' => 'admin',
                    'currency_code' => $currency,
                    'shipping_amount' => $shippingMinor,
                    'discount_amount' => $discount['amount_minor'],
                    'store_credit_amount' => $storeCreditMinor,
                    'notes' => $data['notes'] ?? null,
                    'created_by' => $request->user()->id,
                    ...$shipping,
                ]);

                if ($discount['coupon']) {
                    CouponResolver::recordUsage($discount['coupon'], $order, $discount['amount_minor']);
                }

                StoreCreditResolver::redeem($data['customer_id'], $data['store_id'], $storeCreditMinor, $order, $request->user()->id);

                OrderPlacement::syncItems($order, $data['items'], $currency);
                OrderPlacement::reserveItems($order);

                $order->statusHistory()->create([
                    'from_status' => null,
                    'to_status' => 'pending',
                    'created_by' => $request->user()->id,
                ]);

                return $order;
            });
        } catch (InsufficientStockException|CouponException|StoreCreditException $exception) {
            return ApiResponse::error($exception->getMessage(), [], 422);
        }

        SafeNotification::send($order->customer, new OrderPlacedNotification($order));

        return ApiResponse::success(new OrderResource($order->load(self::RELATIONS)), 'Order created successfully.', status: 201);
    }

    public function show(Order $order): JsonResponse
    {
        $this->authorize('view', $order);

        return ApiResponse::success(new OrderResource($order->load(self::RELATIONS)), 'Order fetched successfully.');
    }

    public function update(OrderRequest $request, Order $order): JsonResponse
    {
        $this->authorize('update', $order);

        if ($order->status !== 'pending') {
            return ApiResponse::error('Only pending orders can be edited.', [], 422);
        }

        $data = $request->validated();
        $currency = $data['currency_code'] ?? $order->currency_code;
        $shipping = $this->resolveShipping($data);
        $subtotalMinor = $this->subtotalMinor($data['items'], $currency);
        $shippingMinor = Money::fromDecimal($data['shipping_amount'] ?? 0, $currency)->amountMinor;

        try {
            DB::transaction(function () use ($order, $data, $currency, $shipping, $subtotalMinor, $shippingMinor, $request) {
                // The request's coupon_code/store_credit_amount (present or
                // not) is always the current source of truth for this
                // order's coupon/credit — release any existing usage up
                // front, whether it's about to be replaced by a
                // freshly-resolved one or dropped entirely. An append-only
                // ledger never deletes the original redemption, so releasing
                // store credit means recording a reversal instead.
                CouponResolver::releaseUsage($order);
                StoreCreditResolver::release($order, $request->user()->id);
                $discount = $this->resolveDiscount($data, $currency, $subtotalMinor, $data['customer_id']);
                $storeCreditMinor = StoreCreditResolver::resolve(
                    $data['customer_id'],
                    $data['store_credit_amount'] ?? null,
                    $currency,
                    max(0, $subtotalMinor + $shippingMinor - $discount['amount_minor']),
                );

                $order->load('items.components');
                $this->releaseReservation($order);
                $order->items()->delete();

                $order->update([
                    'customer_id' => $data['customer_id'],
                    'warehouse_id' => $data['warehouse_id'],
                    'payment_method' => $data['payment_method'],
                    'currency_code' => $currency,
                    'shipping_amount' => $shippingMinor,
                    'discount_amount' => $discount['amount_minor'],
                    'store_credit_amount' => $storeCreditMinor,
                    'notes' => $data['notes'] ?? null,
                    ...$shipping,
                ]);

                if ($discount['coupon']) {
                    CouponResolver::recordUsage($discount['coupon'], $order, $discount['amount_minor']);
                }

                StoreCreditResolver::redeem($data['customer_id'], $order->store_id, $storeCreditMinor, $order, $request->user()->id);

                OrderPlacement::syncItems($order, $data['items'], $currency);
                OrderPlacement::reserveItems($order);
            });
        } catch (InsufficientStockException|CouponException|StoreCreditException $exception) {
            return ApiResponse::error($exception->getMessage(), [], 422);
        }

        return ApiResponse::success(new OrderResource($order->load(self::RELATIONS)), 'Order updated successfully.');
    }

    public function process(Order $order): JsonResponse
    {
        $this->authorize('update', $order);

        if ($order->status !== 'pending') {
            return ApiResponse::error('Only pending orders can be moved to processing.', [], 422);
        }

        DB::transaction(function () use ($order) {
            $order->update(['status' => 'processing']);
            $order->statusHistory()->create([
                'from_status' => 'pending',
                'to_status' => 'processing',
                'created_by' => request()->user()->id,
            ]);
        });

        SafeNotification::send($order->customer, new OrderStatusChangedNotification($order));

        return ApiResponse::success(new OrderResource($order->load(self::RELATIONS)), 'Order moved to processing.');
    }

    public function ship(Order $order): JsonResponse
    {
        $this->authorize('update', $order);

        if (! in_array($order->status, ['pending', 'processing'], true)) {
            return ApiResponse::error('Only pending or processing orders can be shipped.', [], 422);
        }

        try {
            DB::transaction(function () use ($order) {
                $fromStatus = $order->status;

                foreach ($order->items()->with('components')->get() as $item) {
                    foreach ($item->resolvedComponents() as $component) {
                        $level = StockLevel::query()
                            ->where('product_id', $component->product_id)
                            ->where('product_variant_id', $component->product_variant_id)
                            ->where('warehouse_id', $order->warehouse_id)
                            ->lockForUpdate()
                            ->first();

                        $before = $level?->quantity ?? 0;
                        $after = $before - $component->quantity;

                        if ($after < 0 || ($level?->quantity_reserved ?? 0) < $component->quantity) {
                            $product = Product::findOrFail($component->product_id);
                            throw new InsufficientStockException("Stock for \"{$product->name}\" is inconsistent with this order's reservation.");
                        }

                        $level->update([
                            'quantity' => $after,
                            'quantity_reserved' => $level->quantity_reserved - $component->quantity,
                        ]);

                        StockMovement::create([
                            'store_id' => $order->store_id,
                            'product_id' => $component->product_id,
                            'product_variant_id' => $component->product_variant_id,
                            'warehouse_id' => $order->warehouse_id,
                            'type' => 'sale',
                            'quantity' => $component->quantity,
                            'quantity_before' => $before,
                            'quantity_after' => $after,
                            'reference_type' => Order::class,
                            'reference_id' => $order->id,
                            'created_by' => request()->user()->id,
                        ]);
                    }
                }

                $order->update(['status' => 'shipped']);
                $order->statusHistory()->create([
                    'from_status' => $fromStatus,
                    'to_status' => 'shipped',
                    'created_by' => request()->user()->id,
                ]);
            });
        } catch (InsufficientStockException $exception) {
            return ApiResponse::error($exception->getMessage(), [], 422);
        }

        SafeNotification::send($order->customer, new OrderStatusChangedNotification($order));

        return ApiResponse::success(new OrderResource($order->load(self::RELATIONS)), 'Order shipped successfully.');
    }

    public function deliver(Order $order): JsonResponse
    {
        $this->authorize('update', $order);

        if ($order->status !== 'shipped') {
            return ApiResponse::error('Only shipped orders can be marked delivered.', [], 422);
        }

        if ($order->shipments()->exists()) {
            return ApiResponse::error('This order has a courier shipment — mark that shipment delivered instead.', [], 422);
        }

        DB::transaction(function () use ($order) {
            $order->update(['status' => 'delivered']);
            $order->statusHistory()->create([
                'from_status' => 'shipped',
                'to_status' => 'delivered',
                'created_by' => request()->user()->id,
            ]);
        });

        SafeNotification::send($order->customer, new OrderStatusChangedNotification($order));

        return ApiResponse::success(new OrderResource($order->load(self::RELATIONS)), 'Order marked as delivered.');
    }

    public function cancel(Request $request, Order $order): JsonResponse
    {
        $this->authorize('cancel', $order);

        if (! in_array($order->status, ['pending', 'processing'], true)) {
            return ApiResponse::error('Only pending or processing orders can be cancelled.', [], 422);
        }

        DB::transaction(function () use ($order, $request) {
            $fromStatus = $order->status;

            $order->load('items.components');
            $this->releaseReservation($order);
            CouponResolver::releaseUsage($order);
            StoreCreditResolver::release($order, $request->user()->id);

            $order->update(['status' => 'cancelled']);
            $order->statusHistory()->create([
                'from_status' => $fromStatus,
                'to_status' => 'cancelled',
                'note' => $request->input('note'),
                'created_by' => $request->user()->id,
            ]);
        });

        SafeNotification::send($order->customer, new OrderStatusChangedNotification($order));

        return ApiResponse::success(new OrderResource($order->load(self::RELATIONS)), 'Order cancelled successfully.');
    }

    private function subtotalMinor(array $items, string $currency): int
    {
        return array_sum(array_map(
            fn (array $item) => $item['quantity'] * Money::fromDecimal($item['unit_price'], $currency)->amountMinor,
            $items,
        ));
    }

    /**
     * A coupon_code resolves and locks the coupon (throwing CouponException
     * on any validation failure); otherwise discount_amount is the same
     * plain manual entry Wave 1 always accepted.
     *
     * @return array{amount_minor: int, coupon: ?Coupon}
     */
    private function resolveDiscount(array $data, string $currency, int $subtotalMinor, int $customerId): array
    {
        if (! empty($data['coupon_code'])) {
            $resolved = CouponResolver::resolve($data['store_id'], $data['coupon_code'], $subtotalMinor, $customerId);

            return ['amount_minor' => $resolved['discount_amount'], 'coupon' => $resolved['coupon']];
        }

        return [
            'amount_minor' => Money::fromDecimal($data['discount_amount'] ?? 0, $currency)->amountMinor,
            'coupon' => null,
        ];
    }

    /** Resolves the shipping snapshot from either a saved address or the manually entered fields. */
    private function resolveShipping(array $data): array
    {
        if (! empty($data['customer_address_id'])) {
            $address = CustomerAddress::findOrFail($data['customer_address_id']);

            return [
                'customer_address_id' => $address->id,
                'shipping_recipient_name' => $address->recipient_name,
                'shipping_phone' => $address->phone,
                'shipping_address_line' => $address->address_line,
                'shipping_bd_division_id' => $address->bd_division_id,
                'shipping_bd_district_id' => $address->bd_district_id,
                'shipping_bd_upazila_id' => $address->bd_upazila_id,
            ];
        }

        return [
            'customer_address_id' => null,
            'shipping_recipient_name' => $data['shipping_recipient_name'],
            'shipping_phone' => $data['shipping_phone'],
            'shipping_address_line' => $data['shipping_address_line'],
            'shipping_bd_division_id' => $data['shipping_bd_division_id'] ?? null,
            'shipping_bd_district_id' => $data['shipping_bd_district_id'] ?? null,
            'shipping_bd_upazila_id' => $data['shipping_bd_upazila_id'] ?? null,
        ];
    }

    /** Releases this order's reserved stock without touching on-hand quantity. Requires items.components to be loaded. */
    private function releaseReservation(Order $order): void
    {
        foreach ($order->items as $item) {
            foreach ($item->resolvedComponents() as $component) {
                $level = StockLevel::query()
                    ->where('product_id', $component->product_id)
                    ->where('product_variant_id', $component->product_variant_id)
                    ->where('warehouse_id', $order->warehouse_id)
                    ->lockForUpdate()
                    ->first();

                if ($level) {
                    $level->update(['quantity_reserved' => max(0, $level->quantity_reserved - $component->quantity)]);
                }
            }
        }
    }
}
