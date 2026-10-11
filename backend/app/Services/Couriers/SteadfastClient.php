<?php

namespace App\Services\Couriers;

use App\Models\Courier;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Thin client for the Steadfast Courier merchant API
 * (https://portal.packzy.com/api/v1). Credentials live on the Courier record.
 */
class SteadfastClient
{
    private const BASE_URL = 'https://portal.packzy.com/api/v1';

    /**
     * Steadfast only accepts 11-digit local mobile numbers (01XXXXXXXXX).
     * Accepts +880 / 880 prefixed and spaced/dashed input; null if unusable.
     */
    public static function normalisePhone(string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if (str_starts_with($digits, '880')) {
            $digits = '0'.substr($digits, 3);
        }

        return preg_match('/^01[3-9]\d{8}$/', $digits) === 1 ? $digits : null;
    }

    /**
     * Books a parcel. Returns the consignment id (used for status lookups),
     * the tracking code customers use, and Steadfast's initial status.
     *
     * @param  array{invoice: string, recipient_name: string, recipient_phone: string, recipient_address: string, cod_amount: string|float|int, note?: string|null}  $payload
     * @return array{consignment_id: string, tracking_code: string, status: string|null}
     */
    public function createOrder(Courier $courier, array $payload): array
    {
        $response = $this->request($courier)->post(self::BASE_URL.'/create_order', array_filter([
            'invoice' => $payload['invoice'],
            'recipient_name' => mb_substr($payload['recipient_name'], 0, 100),
            'recipient_phone' => $payload['recipient_phone'],
            'recipient_address' => mb_substr($payload['recipient_address'], 0, 250),
            'cod_amount' => (float) $payload['cod_amount'],
            'note' => $payload['note'] ?? null,
        ], fn ($value) => $value !== null));

        $json = $this->decode($response);
        $consignment = $json['consignment'] ?? null;

        if (! is_array($consignment) || empty($consignment['consignment_id'])) {
            throw new CourierApiException($this->errorMessage($json, 'Steadfast did not accept this order.'));
        }

        return [
            'consignment_id' => (string) $consignment['consignment_id'],
            'tracking_code' => (string) ($consignment['tracking_code'] ?? $consignment['consignment_id']),
            'status' => $consignment['status'] ?? null,
        ];
    }

    /** Steadfast's current delivery status for a consignment id. */
    public function status(Courier $courier, string $consignmentId): ?string
    {
        $json = $this->decode($this->request($courier)->get(self::BASE_URL.'/status_by_cid/'.rawurlencode($consignmentId)));

        return $json['delivery_status'] ?? null;
    }

    /** Current account balance; also proves the key/secret pair works. */
    public function balance(Courier $courier): float
    {
        $json = $this->decode($this->request($courier)->get(self::BASE_URL.'/get_balance'));

        if (! array_key_exists('current_balance', $json)) {
            throw new CourierApiException($this->errorMessage($json, 'Steadfast did not return a balance.'));
        }

        return (float) $json['current_balance'];
    }

    private function request(Courier $courier): PendingRequest
    {
        return Http::timeout(20)->acceptJson()->asJson()->withHeaders([
            'Api-Key' => (string) $courier->api_key,
            'Secret-Key' => (string) $courier->api_secret,
        ]);
    }

    /** @return array<string, mixed> */
    private function decode(Response $response): array
    {
        if ($response->status() === 401 || $response->status() === 403) {
            throw new CourierApiException('Steadfast rejected the API key or secret.');
        }

        $json = $response->json();

        if (! is_array($json)) {
            throw new CourierApiException('Steadfast returned an unexpected response (HTTP '.$response->status().').');
        }

        if ($response->failed()) {
            throw new CourierApiException($this->errorMessage($json, 'Steadfast returned HTTP '.$response->status().'.'));
        }

        return $json;
    }

    /** @param array<string, mixed> $json */
    private function errorMessage(array $json, string $fallback): string
    {
        $errors = $json['errors'] ?? null;

        if (is_array($errors) && $errors !== []) {
            $first = collect($errors)->flatten()->first();

            return 'Steadfast: '.(is_string($first) ? $first : $fallback);
        }

        $message = $json['message'] ?? null;

        return is_string($message) && $message !== '' ? 'Steadfast: '.$message : $fallback;
    }
}
