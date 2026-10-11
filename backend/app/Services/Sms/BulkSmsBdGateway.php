<?php

namespace App\Services\Sms;

use App\Contracts\SmsGateway;
use App\Services\Couriers\CourierApiException;
use App\Services\Couriers\SteadfastClient;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/** BulkSMSBD (bulksmsbd.net) HTTP API gateway, built per store from its saved credentials. */
class BulkSmsBdGateway implements SmsGateway
{
    private const SEND_URL = 'http://bulksmsbd.net/api/smsapi';

    private const BALANCE_URL = 'http://bulksmsbd.net/api/getBalanceApi';

    private const ERRORS = [
        1001 => 'Invalid phone number.',
        1002 => 'Sender ID is not correct or not approved.',
        1003 => 'A required field is missing.',
        1005 => 'BulkSMSBD internal error.',
        1006 => 'Balance validity is not available.',
        1007 => 'Insufficient balance.',
        1011 => 'User not found.',
        1012 => 'Masking SMS must be sent in Bangla.',
        1013 => 'No sender ID found for this API key.',
        1014 => 'Sender type not found.',
        1015 => 'No valid sender ID found.',
        1018 => 'The account is disabled.',
        1019 => 'Pricing for this account is disabled.',
        1031 => 'The account is not verified yet.',
        1032 => 'This server IP is not whitelisted in BulkSMSBD.',
    ];

    public function __construct(private readonly string $apiKey, private readonly ?string $senderId = null) {}

    public function send(string $to, string $message): void
    {
        $number = self::formatNumber($to);

        if ($number === null) {
            throw new RuntimeException('Invalid Bangladesh mobile number.');
        }

        $response = Http::timeout(15)->asForm()->post(self::SEND_URL, array_filter([
            'api_key' => $this->apiKey,
            'senderid' => $this->senderId,
            'number' => $number,
            'message' => $message,
        ]));

        $code = (int) ($response->json('response_code') ?? 0);

        if ($code !== 202) {
            $reason = self::ERRORS[$code] ?? ($response->json('error_message') ?: 'The SMS was not accepted.');

            throw new RuntimeException("BulkSMSBD ({$code}): {$reason}");
        }
    }

    /** Remaining SMS balance; also proves the API key is valid. */
    public function balance(): float
    {
        $response = Http::timeout(15)->get(self::BALANCE_URL, ['api_key' => $this->apiKey]);
        $json = $response->json();

        if (is_array($json) && isset($json['balance'])) {
            return (float) $json['balance'];
        }

        if (is_array($json) && isset($json['response_code']) && (int) $json['response_code'] !== 202) {
            $code = (int) $json['response_code'];

            throw new RuntimeException('BulkSMSBD ('.$code.'): '.(self::ERRORS[$code] ?? 'Could not read the balance.'));
        }

        $plain = trim($response->body());

        if (is_numeric($plain)) {
            return (float) $plain;
        }

        throw new RuntimeException('BulkSMSBD returned an unexpected balance response.');
    }

    /** BulkSMSBD wants 8801XXXXXXXXX. */
    public static function formatNumber(string $phone): ?string
    {
        $local = SteadfastClient::normalisePhone($phone);

        return $local === null ? null : '88'.$local;
    }
}
