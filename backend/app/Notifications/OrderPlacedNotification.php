<?php

namespace App\Notifications;

use App\Models\Order;
use App\Support\NotificationRouter;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Sent to the Customer who placed an order — admin- or storefront-sourced, either way. */
class OrderPlacedNotification extends Notification
{
    public function __construct(private readonly Order $order) {}

    public function eventKey(): string
    {
        return 'order_placed';
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
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return NotificationRouter::mail(
            $notifiable,
            $this->eventKey(),
            $this->vars($notifiable),
            'Order Confirmation - {order_number}',
            "Thank you! Your order {order_number} has been placed successfully.\nWe will contact you shortly to confirm delivery.",
        );
    }

    public function toSms(object $notifiable): string
    {
        return NotificationRouter::sms(
            $notifiable,
            $this->eventKey(),
            $this->vars($notifiable),
            "Thank you {customer}! Your order {order_number} has been placed. We'll contact you soon to confirm delivery.",
        );
    }
}
