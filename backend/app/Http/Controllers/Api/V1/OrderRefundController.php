<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\Payments\MerchantPayments;
use App\Support\ApiResponse;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/** Send money back to a shopper through the gateway they paid with. */
class OrderRefundController extends Controller
{
    public function store(Request $request, Order $order, MerchantPayments $payments): JsonResponse
    {
        $this->authorize('recordPayment', $order);

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'reason' => ['nullable', 'string', 'max:200'],
        ]);

        try {
            $payment = $payments->refund($order, Money::fromDecimal($data['amount'], $order->currency_code)->amountMinor, (string) ($data['reason'] ?? ''));
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), [], 502);
        }

        return ApiResponse::success([
            'id' => $payment->id,
            'amount' => (new Money(-$payment->amount_amount, $payment->currency_code))->toDecimal(),
            'payment_status' => $order->fresh()->payment_status,
        ], 'Refund sent.', status: 201);
    }
}
