<?php

namespace App\Notifications;

use App\Support\NotificationRouter;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

/** Sent to someone who signed up for the admin area; the link proves they own the address. */
class VerifyStaffEmailNotification extends Notification
{
    public function eventKey(): string
    {
        return 'staff_email_verification';
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = URL::temporarySignedRoute('staff.verification.verify', now()->addDay(), [
            'id' => $notifiable->getKey(),
            'hash' => sha1((string) $notifiable->email),
        ]);

        $site = parse_url((string) config('app.frontend_url'), PHP_URL_HOST) ?: config('app.name');

        $message = (new MailMessage)
            ->subject("Verify your email for {$site}")
            ->greeting("Hi {$notifiable->name},")
            ->line("Thanks for creating an account for the {$site} admin area. Confirm your email address to finish signing up.")
            ->action('Verify email address', $url)
            ->line('The link is valid for 24 hours. If you did not create this account, you can ignore this email.')
            ->line('After verifying, an administrator needs to give your account a role before you can see store data.');

        return NotificationRouter::withStoreMailer($message, $notifiable->current_store_id);
    }
}
