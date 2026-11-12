<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Order\OrderPaymentRequest;
use App\Models\Order;
use App\Models\Payment;
use App\Support\ApiResponse;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Reconciles non-COD payment methods (bkash/nagad/rocket/card/bank_transfer)
 * against an order's total — the producer Orders Wave 1 never had, since
 * only COD gets its payment_status set automatically, by Phase 9's
 * shipment-delivered flow (ShipmentController::delivered()). A separate
 * controller from OrderController, mirroring SupplierPaymentController: a
 * genuinely different permission (`orders.record_payment`) from the rest of
 * `OrderPolicy`, owned by Accountant rather than whoever creates the order.
 */
class OrderPaymentController extends Controller
{
    public function store(OrderPaymentRequest $request, Order $order): JsonResponse
    {
        $this->authorize('recordPayment', $order);

        if ($order->status === 'cancelled') {
            return ApiResponse::error('Cannot record a payment against a cancelled order.', [], 422);
        }

        if ($order->payment_status === 'refunded') {
            return ApiResponse::error('This order has already been refunded.', [], 422);
        }

        $data = $request->validated();

        $payment = DB::transaction(function () use ($order, $data, $request) {
            $payment = Payment::create([
                'store_id' => $order->store_id,
                'order_id' => $order->id,
                'amount_amount' => Money::fromDecimal($data['amount'], $order->currency_code)->amountMinor,
                'currency_code' => $order->currency_code,
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'note' => $data['note'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            $this->recomputePaymentStatus($order);

            return $payment;
        });

        return ApiResponse::success([
            'id' => $payment->id,
            'amount' => (new Money($payment->amount_amount, $payment->currency_code))->toDecimal(),
            'method' => $payment->method,
            'payment_status' => $order->fresh()->payment_status,
            'created_at' => $payment->created_at,
        ], 'Payment recorded successfully.', status: 201);
    }

    private function recomputePaymentStatus(Order $order): void
    {
        // One rule for manual and online payments (refunds are negative rows).
        app(\App\Services\Payments\MerchantPayments::class)->recomputePaymentStatus($order);
    }
}
