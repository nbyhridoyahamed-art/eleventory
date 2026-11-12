<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A plain billing message to an account owner (reminders, invoices, receipts, suspension). */
class BillingNoticeNotification extends Notification
{
    public function __construct(private string $subject, private array $lines) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)->subject($this->subject)->greeting('Hello,');

        foreach ($this->lines as $line) {
            $mail->line($line);
        }

        return $mail->action('Open billing', rtrim((string) config('app.frontend_url'), '/').'/dashboard/settings/billing');
    }
}
