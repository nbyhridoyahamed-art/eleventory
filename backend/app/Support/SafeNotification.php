<?php

namespace App\Support;

use App\Models\NotificationLog;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;

/**
 * Sends a notification without ever failing the request that triggered it:
 * a mail server or SMS provider outage must not roll back an order. Failures
 * are logged (and shown in Settings → Notifications → Send log).
 */
class SafeNotification
{
    public static function send(mixed $notifiables, object $notification): void
    {
        try {
            Notification::send($notifiables, $notification);
        } catch (Throwable $e) {
            Log::warning('Notification failed: '.$e->getMessage(), ['notification' => $notification::class]);

            $first = is_iterable($notifiables) ? collect($notifiables)->first() : $notifiables;

            NotificationLog::create([
                'store_id' => $first->store_id ?? null,
                'channel' => 'email',
                'event' => method_exists($notification, 'eventKey') ? $notification->eventKey() : null,
                'recipient' => (string) ($first->email ?? $first->phone ?? 'unknown'),
                'status' => 'failed',
                'error' => mb_substr($e->getMessage(), 0, 500),
            ]);
        }
    }
}
