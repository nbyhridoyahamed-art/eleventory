<?php

namespace App\Notifications;

use App\Models\Order;
use App\Support\NotificationRouter;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the Customer on process/ship/deliver/cancel. Reads $order->status
 * fresh at send time rather than taking a status parameter — by the time
 * this fires (after the transaction that changed it), the order's own
 * status is already the new one.
 */
class OrderStatusChangedNotification extends Notification
{
    private const STATUS_TEXT = [
        'processing' => 'is now being processed',
        'shipped' => 'has been shipped',
        'delivered' => 'has been delivered',
        'cancelled' => 'has been cancelled',
    ];

    public function __construct(private readonly Order $order) {}

    public function eventKey(): string
    {
        return 'order_'.$this->order->status;
    }

    public function via(object $notifiable): array
    {
        return NotificationRouter::channels($notifiable, $this->eventKey());
    }

    /** @return array<string, string> */
    private function vars(object $notifiable): array
    {
        return [
            'customer' => (string) $notifiable->name,
            'order_number' => $this->order->order_number,
            'store' => (string) ($this->order->store?->name ?? ''),
            'status' => $this->statusText(),
            'tracking' => (string) ($this->order->shipments()->latest('id')->value('tracking_number') ?? ''),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return NotificationRouter::mail(
            $notifiable,
            $this->eventKey(),
            $this->vars($notifiable),
            'Order Update - {order_number}',
            'Your order {order_number} {status}.',
        );
    }

    public function toSms(object $notifiable): string
    {
        return NotificationRouter::sms($notifiable, $this->eventKey(), $this->vars($notifiable), 'Order {order_number} {status}.');
    }

    private function statusText(): string
    {
        return self::STATUS_TEXT[$this->order->status] ?? "is now {$this->order->status}";
    }
}
