<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A transactional message about something the person just did or asked for (account deletion, data
 * export, ...). Plain on purpose: a heading, a few lines, one button. All of them share Laravel's
 * mail layout (resources/views/vendor/mail), so one edit re-brands every email.
 */
class ServiceNoticeNotification extends Notification
{
    public function __construct(
        private string $subject,
        private array $lines,
        private ?string $actionLabel = null,
        private ?string $actionPath = null,
    ) {}

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

        if ($this->actionLabel && $this->actionPath) {
            $mail->action($this->actionLabel, rtrim((string) config('app.frontend_url'), '/').$this->actionPath);
        }

        return $mail;
    }
}
