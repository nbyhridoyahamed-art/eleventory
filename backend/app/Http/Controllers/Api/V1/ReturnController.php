<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Returns\ReceiveReturnRequest;
use App\Http\Requests\Returns\RefundReturnRequest;
use App\Http\Requests\Returns\ReturnRequest;
use App\Http\Resources\ReturnResource;
use App\Models\Order;
use App\Models\OrderReturn;
use App\Models\ReturnItem;
use App\Models\StockLevel;
use App\Models\StockMovement;
use App\Notifications\ReturnStatusChangedNotification;
use App\Support\ApiResponse;
use App\Support\InsufficientStockException;
use App\Support\Money;
use App\Support\OrderPlacement;
use App\Support\StoreCreditResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Support\SafeNotification;
use Illuminate\Support\Str;

class ReturnController extends Controller
{
    private const RELATIONS = [
        'order.customer', 'items.orderItem.product', 'items.orderItem.productVariant',
        'items.exchangeProduct', 'items.exchangeProductVariant', 'replacementOrder',
        'creator', 'statusHistory.creator',
    ];

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', OrderReturn::class);

        $perPage = min((int) $request->integer('per_page', 20), 100);

        $returns = OrderReturn::query()
            ->with(self::RELATIONS)
            ->when($request->filled('store_id'), fn ($query) => $query->where('store_id', $request->integer('store_id')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('order_id'), fn ($query) => $query->where('order_id', $request->integer('order_id')))
            ->latest()
            ->paginate($perPage);

        return ApiResponse::success(
            ReturnResource::collection($returns),
            'Returns fetched successfully.',
            [
                'current_page' => $returns->currentPage(),
                'per_page' => $returns->perPage(),
                'total' => $returns->total(),
                'last_page' => $returns->lastPage(),
            ],
        );
    }

    public function store(ReturnRequest $request, Order $order): JsonResponse
    {
        $this->authorize('create', OrderReturn::class);

        if ($order->status !== 'delivered') {
            return ApiResponse::error('Only delivered orders can have a return requested.', [], 422);
        }

        $data = $request->validated();

        $return = DB::transaction(function () use ($data, $order, $request) {
            $return = OrderReturn::create([
                'store_id' => $order->store_id,
                'order_id' => $order->id,
                'return_number' => 'RET-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
                'status' => 'requested',
                'reason' => $data['reason'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['items'] as $item) {
                $return->items()->create([
                    'order_item_id' => $item['order_item_id'],
                    'quantity' => $item['quantity'],
                    'restock' => $item['restock'] ?? true,
                    'exchange_product_id' => $item['exchange_product_id'] ?? null,
                    'exchange_product_variant_id' => $item['exchange_product_variant_id'] ?? null,
                ]);
            }

            $return->statusHistory()->create([
                'from_status' => null,
                'to_status' => 'requested',
                'created_by' => $request->user()->id,
            ]);

            return $return;
        });

        return ApiResponse::success(new ReturnResource($return->load(self::RELATIONS)), 'Return requested successfully.', status: 201);
    }

    public function show(OrderReturn $orderReturn): JsonResponse
    {
        $this->authorize('view', $orderReturn);

        return ApiResponse::success(new ReturnResource($orderReturn->load(self::RELATIONS)), 'Return fetched successfully.');
    }

    public function approve(OrderReturn $orderReturn): JsonResponse
    {
        $this->authorize('update', $orderReturn);

        if ($orderReturn->status !== 'requested') {
            return ApiResponse::error('Only a requested return can be approved.', [], 422);
        }

        $this->transition($orderReturn, 'approved');

        return ApiResponse::success(new ReturnResource($orderReturn->load(self::RELATIONS)), 'Return approved.');
    }

    public function reject(Request $request, OrderReturn $orderReturn): JsonResponse
    {
        $this->authorize('update', $orderReturn);

        if (! in_array($orderReturn->status, ['requested', 'approved'], true)) {
            return ApiResponse::error('Only a requested or approved return can be rejected.', [], 422);
        }

        $this->transition($orderReturn, 'rejected', $request->input('note'));

        return ApiResponse::success(new ReturnResource($orderReturn->load(self::RELATIONS)), 'Return rejected.');
    }

    public function receive(ReceiveReturnRequest $request, OrderReturn $orderReturn): JsonResponse
    {
        $this->authorize('update', $orderReturn);

        if ($orderReturn->status !== 'approved') {
            return ApiResponse::error('Only an approved return can be marked received.', [], 422);
        }

        $data = $request->validated();

        try {
            DB::transaction(function () use ($data, $orderReturn, $request) {
                $order = $orderReturn->order;
                $overrides = collect($data['items'] ?? [])->keyBy('return_item_id');
                $items = $orderReturn->items()->with('orderItem.components')->get();
                $exchangeLines = [];

                foreach ($items as $returnItem) {
                    if ($overrides->has($returnItem->id)) {
                        $returnItem->update(['restock' => $overrides[$returnItem->id]['restock']]);
                    }

                    if ($returnItem->exchange_product_id) {
                        // Independent of restock — the old item can be both put
                        // back into sellable stock AND exchanged for something
                        // else; this just queues the replacement line, actually
                        // built below once every item's been looked at.
                        $exchangeLines[] = [
                            'product_id' => $returnItem->exchange_product_id,
                            'product_variant_id' => $returnItem->exchange_product_variant_id,
                            'quantity' => $returnItem->quantity,
                            // Free — a return's exchange is a stock/replacement
                            // swap only, no price-difference reconciliation.
                            'unit_price' => 0,
                        ];
                    }

                    if (! $returnItem->restock) {
                        continue;
                    }

                    $orderItem = $returnItem->orderItem;

                    foreach ($orderItem->resolvedComponents() as $component) {
                        // component->quantity is orderItem->quantity's worth of
                        // this component (see order_item_components), so this is
                        // always an exact multiple — restocking a partial return
                        // of a bundle only restocks that fraction of each
                        // component, not the whole line's snapshot.
                        $restockQuantity = $returnItem->quantity * intdiv($component->quantity, $orderItem->quantity);

                        $level = StockLevel::query()
                            ->where('product_id', $component->product_id)
                            ->where('product_variant_id', $component->product_variant_id)
                            ->where('warehouse_id', $order->warehouse_id)
                            ->lockForUpdate()
                            ->first();

                        $before = $level?->quantity ?? 0;
                        $after = $before + $restockQuantity;

                        $level
                            ? $level->update(['quantity' => $after])
                            : StockLevel::create([
                                'product_id' => $component->product_id,
                                'product_variant_id' => $component->product_variant_id,
                                'warehouse_id' => $order->warehouse_id,
                                'quantity' => $after,
                            ]);

                        StockMovement::create([
                            'store_id' => $orderReturn->store_id,
                            'product_id' => $component->product_id,
                            'product_variant_id' => $component->product_variant_id,
                            'warehouse_id' => $order->warehouse_id,
                            'type' => 'return',
                            'quantity' => $restockQuantity,
                            'quantity_before' => $before,
                            'quantity_after' => $after,
                            'reference_type' => OrderReturn::class,
                            'reference_id' => $orderReturn->id,
                            'created_by' => $request->user()->id,
                        ]);
                    }
                }

                $fromStatus = $orderReturn->status;
                $updates = ['status' => 'received'];

                if ($exchangeLines !== []) {
                    $replacementOrder = $this->createReplacementOrder($order, $exchangeLines, $request->user()->id);
                    $updates['replacement_order_id'] = $replacementOrder->id;
                }

                $orderReturn->update($updates);
                $orderReturn->statusHistory()->create([
                    'from_status' => $fromStatus,
                    'to_status' => 'received',
                    'note' => $data['note'] ?? null,
                    'created_by' => $request->user()->id,
                ]);
            });
        } catch (InsufficientStockException $exception) {
            return ApiResponse::error($exception->getMessage(), [], 422);
        }

        SafeNotification::send($orderReturn->order->customer, new ReturnStatusChangedNotification($orderReturn));

        return ApiResponse::success(new ReturnResource($orderReturn->load(self::RELATIONS)), 'Return marked received.');
    }

    /**
     * The zero-value Order that ships a return's exchange item(s) — reuses
     * OrderPlacement (the same bundle-snapshot + stock-reservation path
     * every other order goes through) so "moves stock accordingly" can't
     * drift from how a regular sale does it. Deliberately excludes any
     * price-difference reconciliation (see DATABASE_DESIGN.md): every line
     * is unit_price 0 and payment_status starts already 'paid'.
     */
    private function createReplacementOrder(Order $order, array $items, int $userId): Order
    {
        $replacement = Order::create([
            'store_id' => $order->store_id,
            'order_number' => 'ORD-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
            'customer_id' => $order->customer_id,
            'warehouse_id' => $order->warehouse_id,
            'status' => 'pending',
            'payment_method' => $order->payment_method,
            'payment_status' => 'paid',
            'source' => $order->source,
            'currency_code' => $order->currency_code,
            // Explicit 0s rather than relying on column defaults — the
            // in-memory model Order::create() returns won't reflect a
            // DB-only default until the row is re-fetched, and every
            // OrderResource variant renders these through Money(int).
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'store_credit_amount' => 0,
            'customer_address_id' => $order->customer_address_id,
            'shipping_recipient_name' => $order->shipping_recipient_name,
            'shipping_phone' => $order->shipping_phone,
            'shipping_address_line' => $order->shipping_address_line,
            'shipping_bd_division_id' => $order->shipping_bd_division_id,
            'shipping_bd_district_id' => $order->shipping_bd_district_id,
            'shipping_bd_upazila_id' => $order->shipping_bd_upazila_id,
            'notes' => "Replacement for a return on order {$order->order_number}.",
            'created_by' => $userId,
        ]);

        OrderPlacement::syncItems($replacement, $items, $order->currency_code);
        OrderPlacement::reserveItems($replacement);

        $replacement->statusHistory()->create([
            'from_status' => null,
            'to_status' => 'pending',
            'created_by' => $userId,
        ]);

        return $replacement;
    }

    public function refund(RefundReturnRequest $request, OrderReturn $orderReturn): JsonResponse
    {
        $this->authorize('update', $orderReturn);

        if ($orderReturn->status !== 'received') {
            return ApiResponse::error('Only a received return can be refunded.', [], 422);
        }

        $data = $request->validated();

        DB::transaction(function () use ($data, $orderReturn, $request) {
            $order = $orderReturn->order;
            $refundAmount = isset($data['refund_amount'])
                ? Money::fromDecimal($data['refund_amount'], $order->currency_code)->amountMinor
                : $this->suggestedRefundAmount($orderReturn);
            $refundMethod = $data['refund_method'] ?? 'original_payment';

            $fromStatus = $orderReturn->status;
            $orderReturn->update([
                'status' => 'refunded',
                'refund_amount' => $refundAmount,
                'refund_method' => $refundMethod,
                'refunded_at' => now(),
            ]);

            $orderReturn->statusHistory()->create([
                'from_status' => $fromStatus,
                'to_status' => 'refunded',
                'note' => $data['note'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            if ($refundMethod === 'store_credit') {
                StoreCreditResolver::issue($order->customer_id, $order->store_id, $refundAmount, $orderReturn, $request->user()->id);
            }

            // 'refunded' once every order item is fully covered by refunded
            // returns, 'partially_refunded' as soon as any coverage exists —
            // reconciling across several return records, Wave 1 only ever
            // handled the all-or-nothing case (see DATABASE_DESIGN.md).
            $reconciled = $this->reconciledPaymentStatus($order);
            if ($reconciled !== null) {
                $order->update(['payment_status' => $reconciled]);
            }
        });

        SafeNotification::send($orderReturn->order->customer, new ReturnStatusChangedNotification($orderReturn));

        return ApiResponse::success(new ReturnResource($orderReturn->load(self::RELATIONS)), 'Return refunded.');
    }

    private function transition(OrderReturn $orderReturn, string $toStatus, ?string $note = null): void
    {
        DB::transaction(function () use ($orderReturn, $toStatus, $note) {
            $fromStatus = $orderReturn->status;
            $orderReturn->update(['status' => $toStatus]);

            $orderReturn->statusHistory()->create([
                'from_status' => $fromStatus,
                'to_status' => $toStatus,
                'note' => $note,
                'created_by' => request()->user()->id,
            ]);
        });

        SafeNotification::send($orderReturn->order->customer, new ReturnStatusChangedNotification($orderReturn));
    }

    private function suggestedRefundAmount(OrderReturn $orderReturn): int
    {
        return $orderReturn->items()->with('orderItem')->get()
            ->sum(fn ($item) => $item->quantity * $item->orderItem->unit_price_amount);
    }

    /**
     * 'refunded' once every one of the order's items has been fully covered
     * by refunded returns, 'partially_refunded' as soon as any coverage
     * exists at all, or null if somehow neither (never reached in practice —
     * this only runs right after recording a refund).
     */
    private function reconciledPaymentStatus(Order $order): ?string
    {
        $orderItems = $order->items;

        $refundedByOrderItem = ReturnItem::query()
            ->whereIn('order_item_id', $orderItems->pluck('id'))
            ->whereHas('orderReturn', fn ($query) => $query->where('status', 'refunded'))
            ->selectRaw('order_item_id, sum(quantity) as total')
            ->groupBy('order_item_id')
            ->pluck('total', 'order_item_id');

        if ($refundedByOrderItem->isEmpty()) {
            return null;
        }

        foreach ($orderItems as $orderItem) {
            if (($refundedByOrderItem[$orderItem->id] ?? 0) < $orderItem->quantity) {
                return 'partially_refunded';
            }
        }

        return 'refunded';
    }
}
