<?php

namespace App\Notifications\Channels;

use App\Contracts\SmsGateway;
use App\Models\NotificationLog;
use App\Models\NotificationSetting;
use App\Services\Sms\BulkSmsBdGateway;
use Illuminate\Notifications\Notification;
use Throwable;

/**
 * A custom Laravel notification channel — referenced by its FQCN directly
 * from a Notification's via(). It sends through the store's own BulkSMSBD
 * credentials when Settings → Notifications has them, and otherwise through
 * whatever SmsGateway is bound in AppServiceProvider (the log gateway).
 * Every attempt is written to the notification log; a failing provider never
 * throws into the request that triggered the notification.
 */
class SmsChannel
{
    public function __construct(private readonly SmsGateway $fallback) {}

    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toSms')) {
            return;
        }

        $phone = $notifiable->phone ?? null;

        if (! $phone) {
            return;
        }

        $message = $notification->toSms($notifiable);
        $settings = NotificationSetting::forStore($notifiable->store_id ?? null);

        $gateway = $this->fallback;

        if ($settings !== null) {
            if (! $settings['sms']['enabled']) {
                return;
            }

            if ($settings['sms']['provider'] === 'bulksmsbd' && filled($settings['sms']['api_key'])) {
                $gateway = new BulkSmsBdGateway($settings['sms']['api_key'], $settings['sms']['sender_id']);
            }
        }

        $status = 'sent';
        $error = null;

        try {
            $gateway->send($phone, $message);
        } catch (Throwable $e) {
            $status = 'failed';
            $error = mb_substr($e->getMessage(), 0, 500);
        }

        NotificationLog::create([
            'store_id' => $notifiable->store_id ?? null,
            'channel' => 'sms',
            'event' => method_exists($notification, 'eventKey') ? $notification->eventKey() : null,
            'recipient' => $phone,
            'message' => $message,
            'status' => $status,
            'error' => $error,
        ]);
    }
}
