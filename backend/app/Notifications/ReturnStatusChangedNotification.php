<?php

namespace App\Notifications;

use App\Models\OrderReturn;
use App\Support\NotificationRouter;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Sent to the order's Customer on approve/reject/receive/refund. Same fresh-status-read reasoning as OrderStatusChangedNotification. */
class ReturnStatusChangedNotification extends Notification
{
    private const STATUS_TEXT = [
        'approved' => 'has been approved',
        'rejected' => 'has been rejected',
        'received' => 'has been received at our warehouse',
        'refunded' => 'has been refunded',
    ];

    public function __construct(private readonly OrderReturn $orderReturn) {}

    public function eventKey(): string
    {
        return 'return_'.$this->orderReturn->status;
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
            'return_number' => $this->orderReturn->return_number,
            'order_number' => (string) ($this->orderReturn->order?->order_number ?? ''),
            'store' => (string) ($this->orderReturn->order?->store?->name ?? ''),
            'status' => $this->statusText(),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return NotificationRouter::mail(
            $notifiable,
            $this->eventKey(),
            $this->vars($notifiable),
            'Return Update - {return_number}',
            'Your return {return_number} for order {order_number} {status}.',
        );
    }

    public function toSms(object $notifiable): string
    {
        return NotificationRouter::sms($notifiable, $this->eventKey(), $this->vars($notifiable), 'Return {return_number} {status}.');
    }

    private function statusText(): string
    {
        return self::STATUS_TEXT[$this->orderReturn->status] ?? "is now {$this->orderReturn->status}";
    }
}
