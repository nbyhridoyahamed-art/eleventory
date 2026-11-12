<?php

namespace App\Services\Billing\Gateways;

use App\Models\Invoice;
use App\Models\Organization;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * SSLCommerz hosted checkout (cards, bKash, Nagad, banks) into the PLATFORM's own
 * SSLCommerz account. Merchant stores get their own gateways in Phase 7.
 *
 * Flow: create a session -> redirect the owner to GatewayPageURL -> SSLCommerz posts an IPN
 * to our webhook and sends the browser back to our success/fail URLs. Neither is trusted on
 * its own: confirm() asks SSLCommerz's validation API whether `val_id` is a real, paid
 * transaction for the right amount.
 */
class SslCommerzGateway implements BillingGateway
{
    public function name(): string
    {
        return 'sslcommerz';
    }

    public function checkoutUrl(Invoice $invoice, Organization $organization): ?string
    {
        $response = Http::asForm()->timeout(20)->post($this->base().'/gwprocess/v4/api.php', [
            'store_id' => $this->storeId(),
            'store_passwd' => $this->password(),
            'total_amount' => number_format((float) $invoice->amount, 2, '.', ''),
            'currency' => $invoice->currency,
            'tran_id' => $invoice->tran_id,
            'success_url' => url('/api/v1/billing/return/success'),
            'fail_url' => url('/api/v1/billing/return/fail'),
            'cancel_url' => url('/api/v1/billing/return/cancel'),
            'ipn_url' => url('/api/v1/billing/webhooks/sslcommerz'),
            'cus_name' => $organization->name,
            'cus_email' => $organization->email ?: 'billing@example.com',
            'cus_phone' => $organization->phone ?: '01700000000',
            'cus_add1' => 'Bangladesh',
            'cus_city' => 'Dhaka',
            'cus_country' => 'Bangladesh',
            'shipping_method' => 'NO',
            'product_name' => $invoice->description ?: 'Subscription',
            'product_category' => 'Subscription',
            'product_profile' => 'non-physical-goods',
        ]);

        $url = $response->json('GatewayPageURL');

        if (! $response->ok() || $response->json('status') !== 'SUCCESS' || ! $url) {
            Log::warning('billing.sslcommerz.session_failed', ['invoice' => $invoice->number, 'reason' => $response->json('failedreason')]);

            throw new RuntimeException('The payment page could not be opened. Please try again.');
        }

        return $url;
    }

    public function confirm(array $payload): ?PaymentResult
    {
        $valId = (string) ($payload['val_id'] ?? '');

        if ($valId === '') {
            return null;
        }

        $check = Http::timeout(20)->get($this->base().'/validator/api/validationserverAPI.php', [
            'val_id' => $valId,
            'store_id' => $this->storeId(),
            'store_passwd' => $this->password(),
            'format' => 'json',
        ]);

        if (! $check->ok() || ! $check->json('tran_id')) {
            return null;
        }

        return new PaymentResult(
            (string) $check->json('tran_id'),
            in_array($check->json('status'), ['VALID', 'VALIDATED'], true),
            number_format((float) ($check->json('currency_amount') ?: $check->json('amount')), 2, '.', ''),
            (string) ($check->json('currency_type') ?: $check->json('currency') ?: 'BDT'),
            $check->json() ?? [],
        );
    }

    private function base(): string
    {
        return config('billing.sslcommerz.sandbox') ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com';
    }

    private function storeId(): string
    {
        return (string) config('billing.sslcommerz.store_id');
    }

    private function password(): string
    {
        return (string) config('billing.sslcommerz.store_password');
    }
}
