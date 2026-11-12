<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\StorePaymentGateway;
use App\Services\Billing\PlanLimits;
use App\Services\Payments\MerchantGateway;
use App\Services\Payments\MerchantGateways;
use App\Support\ApiResponse;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** The store owner's own payment provider accounts. Secrets are write-only: they are never sent back. */
class PaymentGatewayController extends Controller
{
    public function __construct(private MerchantGateways $gateways, private PlanLimits $limits) {}

    public function index(Request $request): JsonResponse
    {
        $storeId = $this->storeId($request);
        $accounts = StorePaymentGateway::query()->where('store_id', $storeId)->get()->keyBy('provider');

        return ApiResponse::success(
            collect($this->gateways->all())->map(fn (MerchantGateway $g) => $this->present($g, $accounts->get($g->key()), $storeId))->values()->all(),
            'Payment gateways fetched successfully.',
        );
    }

    public function update(Request $request, string $provider): JsonResponse
    {
        $storeId = $this->storeId($request);
        $gateway = $this->gateways->get($provider);

        abort_unless($gateway, 404);

        $data = $request->validate([
            'is_enabled' => ['required', 'boolean'],
            'test_mode' => ['required', 'boolean'],
            'credentials' => ['nullable', 'array'],
            'credentials.*' => ['nullable', 'string', 'max:500'],
        ]);

        $account = StorePaymentGateway::query()->firstOrNew(['store_id' => $storeId, 'provider' => $provider]);

        // A blank secret means "keep the one I saved"; only fields the gateway knows are accepted.
        $merged = $account->credentials ?? [];
        foreach ($gateway->credentialFields() as $field) {
            $value = trim((string) ($data['credentials'][$field['key']] ?? ''));
            if ($value !== '') {
                $merged[$field['key']] = $value;
            }
        }

        if ($data['is_enabled']) {
            $this->limits->assertFeature($storeId, 'online_payments');

            if ($problem = $gateway->credentialProblem($merged, $data['test_mode'])) {
                throw ValidationException::withMessages(['credentials' => $problem]);
            }
        }

        $account->forceFill([
            'is_enabled' => $data['is_enabled'],
            'test_mode' => $data['test_mode'],
            'credentials' => $merged,
        ])->save();

        return ApiResponse::success($this->present($gateway, $account, $storeId), 'Payment gateway saved.');
    }

    private function present(MerchantGateway $gateway, ?StorePaymentGateway $account, int $storeId): array
    {
        return [
            'key' => $gateway->key(),
            'label' => $gateway->label(),
            'description' => $gateway->description(),
            'is_enabled' => (bool) $account?->is_enabled,
            'test_mode' => $account?->test_mode ?? true,
            // Which credentials are saved, never their values.
            'fields' => collect($gateway->credentialFields())->map(fn (array $f) => $f + ['saved' => $account && $account->credential($f['key']) !== ''])->all(),
            'webhook_url' => url("/api/v1/payments/webhooks/{$gateway->key()}/{$storeId}"),
        ];
    }

    private function storeId(Request $request): int
    {
        if (! $request->user()->can('settings.manage')) {
            throw new AuthorizationException;
        }

        return (int) (app(TenantContext::class)->storeId() ?? $request->user()->current_store_id);
    }
}
