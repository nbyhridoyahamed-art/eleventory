<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-store SMS (BulkSMSBD) and email (SMTP) delivery settings, per-event
 * on/off switches and message templates. The whole payload is stored
 * encrypted because it holds the SMS API key and the SMTP password.
 */
#[Fillable(['store_id', 'data'])]
class NotificationSetting extends Model
{
    /** Event key => label. Keys are used in templates, switches and the send log. */
    public const EVENTS = [
        'order_placed' => 'Order placed',
        'order_processing' => 'Order processing',
        'order_shipped' => 'Order shipped',
        'order_delivered' => 'Order delivered',
        'order_cancelled' => 'Order cancelled',
        'return_approved' => 'Return approved',
        'return_rejected' => 'Return rejected',
        'return_received' => 'Return received',
        'return_refunded' => 'Return refunded',
    ];

    protected function casts(): array
    {
        return ['data' => 'encrypted:array'];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /** @return array<string, mixed> */
    public static function defaults(): array
    {
        $events = [];
        $templates = [];

        foreach (array_keys(self::EVENTS) as $key) {
            $events[$key] = ['sms' => true, 'email' => true];
            $templates[$key] = ['sms' => null, 'email_subject' => null, 'email_body' => null];
        }

        return [
            'sms' => ['enabled' => false, 'provider' => 'bulksmsbd', 'api_key' => null, 'sender_id' => null],
            'email' => [
                'enabled' => false,
                'host' => null,
                'port' => 587,
                'encryption' => 'tls',
                'username' => null,
                'password' => null,
                'from_address' => null,
                'from_name' => null,
            ],
            'events' => $events,
            'templates' => $templates,
        ];
    }

    /**
     * The stored settings merged over the defaults, or null when this store
     * has never saved any (in which case the app keeps its original
     * behaviour: log mailer and log SMS gateway).
     *
     * @return array<string, mixed>|null
     */
    public static function forStore(?int $storeId): ?array
    {
        if (! $storeId) {
            return null;
        }

        $row = static::query()->where('store_id', $storeId)->first();

        return $row ? static::merge($row->data ?? []) : null;
    }

    /**
     * @param  array<string, mixed>  $stored
     * @return array<string, mixed>
     */
    public static function merge(array $stored): array
    {
        $defaults = self::defaults();

        foreach (['sms', 'email'] as $group) {
            $defaults[$group] = array_merge($defaults[$group], $stored[$group] ?? []);
        }

        foreach (array_keys(self::EVENTS) as $key) {
            $defaults['events'][$key] = array_merge($defaults['events'][$key], $stored['events'][$key] ?? []);
            $defaults['templates'][$key] = array_merge($defaults['templates'][$key], $stored['templates'][$key] ?? []);
        }

        return $defaults;
    }
}
