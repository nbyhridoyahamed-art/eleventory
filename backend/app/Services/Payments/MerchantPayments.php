<?php

namespace App\Services\Payments;

use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\StorePaymentGateway;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Taking a store's online payments: open a payment page, settle verified results into Payment
 * rows exactly once, and send refunds back through the same provider.
 */
class MerchantPayments
{
    public function __construct(private MerchantGateways $gateways) {}

    /** Gateways a shopper may use on this store right now. @return array<int, array{key: string, label: string}> */
    public function enabledFor(int $storeId): array
    {
        if (! $this->planAllowsOnlinePayments($storeId)) {
            return [];
        }

        return StorePaymentGateway::query()->where('store_id', $storeId)->where('is_enabled', true)->get()
            ->map(fn (StorePaymentGateway $account) => ($gateway = $this->gateways->get($account->provider)) ? ['key' => $gateway->key(), 'label' => $gateway->label(), 'test_mode' => $account->test_mode] : null)
            ->filter()->values()->all();
    }

    /** Online payments are a plan feature; a lapsed or smaller plan switches them off at the till. */
    private function planAllowsOnlinePayments(int $storeId): bool
    {
        $limits = app(\App\Services\Billing\PlanLimits::class);
        $organization = $limits->organizationForStore($storeId);

        return ! $organization || $limits->feature($organization, 'online_payments');
    }

    public function accountFor(int $storeId, string $provider): ?StorePaymentGateway
    {
        return StorePaymentGateway::query()->where('store_id', $storeId)->where('provider', $provider)->first();
    }

    /**
     * Start paying for an order. Returns the URL to send the shopper to.
     *
     * @throws RuntimeException when the provider cannot open a payment page
     */
    public function start(Order $order, string $provider, ?string $returnUrl = null): string
    {
        $account = $this->accountFor($order->store_id, $provider);
        $gateway = $this->gateways->get($provider);

        if (! $account || ! $account->is_enabled || ! $gateway || ! $this->planAllowsOnlinePayments($order->store_id)) {
            throw new RuntimeException('This payment method is not available.');
        }

        $attempt = PaymentAttempt::create([
            'store_id' => $order->store_id,
            'order_id' => $order->id,
            'provider' => $provider,
            'tran_id' => 'P'.strtoupper(Str::random(20)),
            'amount_minor' => $order->totalAmount(),
            'currency_code' => $order->currency_code,
            'status' => PaymentAttempt::INITIATED,
            'test_mode' => $account->test_mode,
            'return_url' => $returnUrl,
        ]);

        $back = fn (string $outcome) => url("/api/v1/payments/return/{$attempt->tran_id}/{$outcome}");

        return $gateway->startCheckout($account, $attempt, $order, [
            'success' => $back('success'),
            'fail' => $back('fail'),
            'cancel' => $back('cancel'),
            'ipn' => url("/api/v1/payments/webhooks/{$provider}/{$order->store_id}"),
        ]);
    }

    /**
     * Record a verified provider outcome. Safe to call any number of times (webhook retries, the
     * shopper returning, both): the money is recorded once. A result for the wrong amount or
     * currency never marks anything paid.
     */
    public function settle(PaymentAttempt $attempt, GatewayPayment $result): PaymentAttempt
    {
        return DB::transaction(function () use ($attempt, $result) {
            $attempt = PaymentAttempt::whereKey($attempt->id)->lockForUpdate()->firstOrFail();

            if ($attempt->status === PaymentAttempt::PAID || $result->tranId !== $attempt->tran_id) {
                return $attempt;
            }

            if (! $result->paid) {
                $attempt->update(['status' => PaymentAttempt::FAILED, 'gateway_payload' => $result->raw ?: $attempt->gateway_payload]);

                return $attempt;
            }

            if ($result->amountMinor !== $attempt->amount_minor || strtoupper($result->currency) !== strtoupper($attempt->currency_code)) {
                Log::warning('payments.amount_mismatch', ['attempt' => $attempt->id, 'expected' => $attempt->amount_minor, 'got' => $result->amountMinor, 'currency' => $result->currency]);
                $attempt->update(['status' => PaymentAttempt::MISMATCH, 'gateway_payload' => $result->raw]);

                return $attempt;
            }

            $order = Order::query()->whereKey($attempt->order_id)->firstOrFail();

            Payment::create([
                'store_id' => $attempt->store_id,
                'order_id' => $order->id,
                'amount_amount' => $attempt->amount_minor,
                'currency_code' => $attempt->currency_code,
                'method' => $attempt->provider,
                'reference' => $result->reference ?: $attempt->tran_id,
                'note' => ($attempt->test_mode ? 'TEST ' : '').'Online payment',
            ]);

            $attempt->update(['status' => PaymentAttempt::PAID, 'provider_reference' => $result->reference, 'gateway_payload' => $result->raw]);
            $this->recomputePaymentStatus($order);

            return $attempt;
        });
    }

    public function markCancelled(PaymentAttempt $attempt, string $status = PaymentAttempt::CANCELLED): void
    {
        if ($attempt->status === PaymentAttempt::INITIATED) {
            $attempt->update(['status' => $status]);
        }
    }

    /**
     * Refund part or all of what a shopper paid online. Goes to the provider first; only when it
     * accepts is a (negative) payment recorded.
     *
     * @throws ValidationException|RuntimeException
     */
    public function refund(Order $order, int $amountMinor, string $reason): Payment
    {
        $attempt = PaymentAttempt::query()->where('order_id', $order->id)->where('status', PaymentAttempt::PAID)->latest('id')->first();

        if (! $attempt) {
            throw ValidationException::withMessages(['amount' => 'This order was not paid online, so there is nothing to send back through a gateway.']);
        }

        $refundable = $attempt->amount_minor - $attempt->refunded_minor;

        if ($amountMinor <= 0 || $amountMinor > $refundable) {
            throw ValidationException::withMessages(['amount' => 'You can refund at most '.(new Money($refundable, $attempt->currency_code))->toDecimal().' on this payment.']);
        }

        $account = $this->accountFor($attempt->store_id, $attempt->provider);
        $gateway = $this->gateways->get($attempt->provider);

        if (! $account || ! $gateway) {
            throw new RuntimeException('The payment provider for this order is no longer set up.');
        }

        $reference = $gateway->refund($account, $attempt, $amountMinor, $reason);

        return DB::transaction(function () use ($attempt, $order, $amountMinor, $reason, $reference) {
            $attempt->increment('refunded_minor', $amountMinor);

            $payment = Payment::create([
                'store_id' => $attempt->store_id,
                'order_id' => $order->id,
                'amount_amount' => -$amountMinor,
                'currency_code' => $attempt->currency_code,
                'method' => $attempt->provider,
                'reference' => $reference,
                'note' => 'Refund'.($reason !== '' ? ': '.$reason : ''),
            ]);

            $this->recomputePaymentStatus($order);

            return $payment;
        });
    }

    /** Whether this order's money came in through a gateway (so it can go back the same way). */
    public function hasPaidOnlineAttempt(Order $order): bool
    {
        return PaymentAttempt::query()->where('order_id', $order->id)->where('status', PaymentAttempt::PAID)->exists();
    }

    /** paid / partially_paid / unpaid from the payments on the order; refunds are negative rows. */
    public function recomputePaymentStatus(Order $order): void
    {
        $order->load('items');
        $payments = $order->payments()->get();
        $netMinor = (int) $payments->sum('amount_amount');
        $refunded = $payments->contains(fn (Payment $p) => $p->amount_amount < 0);
        $totalMinor = $order->totalAmount();

        $status = match (true) {
            $refunded && $netMinor <= 0 => 'refunded',
            $refunded && $netMinor < $totalMinor => 'partially_refunded',
            $netMinor <= 0 => 'unpaid',
            $netMinor < $totalMinor => 'partially_paid',
            default => 'paid',
        };

        $order->update(['payment_status' => $status]);
    }
}
