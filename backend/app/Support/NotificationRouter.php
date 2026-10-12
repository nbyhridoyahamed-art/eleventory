<?php

namespace App\Support;

use App\Models\NotificationSetting;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Mail;

/**
 * Decides which channels a customer notification uses and renders its text,
 * from the store's saved Settings → Notifications (SMS / email) configuration.
 *
 * A store that has never saved notification settings keeps the original
 * behaviour (default mailer + log SMS gateway) so nothing changes until an
 * admin configures it.
 */
class NotificationRouter
{
    public const MAILER = 'store_smtp';

    /** @return array<string, mixed>|null */
    public static function settings(object $notifiable): ?array
    {
        return NotificationSetting::forStore($notifiable->store_id ?? null);
    }

    /** @return array<int, string> */
    public static function channels(object $notifiable, string $event): array
    {
        $settings = self::settings($notifiable);

        if ($settings === null) {
            return array_values(array_filter([
                ! empty($notifiable->email) ? 'mail' : null,
                SmsChannel::class,
            ]));
        }

        $switch = $settings['events'][$event] ?? ['sms' => true, 'email' => true];

        return array_values(array_filter([
            ! empty($notifiable->email) && $settings['email']['enabled'] && $switch['email'] ? 'mail' : null,
            ! empty($notifiable->phone) && $settings['sms']['enabled'] && $switch['sms'] ? SmsChannel::class : null,
        ]));
    }

    /** @param array<string, scalar|null> $vars */
    public static function render(string $template, array $vars): string
    {
        return preg_replace_callback('/\{(\w+)\}/', fn ($m) => (string) ($vars[$m[1]] ?? $m[0]), $template) ?? $template;
    }

    /** @param array<string, scalar|null> $vars */
    public static function sms(object $notifiable, string $event, array $vars, string $default): string
    {
        $template = self::settings($notifiable)['templates'][$event]['sms'] ?? null;

        return self::render(filled($template) ? $template : $default, $vars);
    }

    /** @param array<string, scalar|null> $vars */
    public static function mail(object $notifiable, string $event, array $vars, string $defaultSubject, string $defaultBody): MailMessage
    {
        $settings = self::settings($notifiable);
        $template = $settings['templates'][$event] ?? [];

        $subject = self::render(filled($template['email_subject'] ?? null) ? $template['email_subject'] : $defaultSubject, $vars);
        $body = self::render(filled($template['email_body'] ?? null) ? $template['email_body'] : $defaultBody, $vars);

        $message = (new MailMessage)->subject($subject)->greeting('Hi '.($vars['customer'] ?? '').',');

        foreach (preg_split('/\R+/', trim($body)) ?: [] as $line) {
            $message->line($line);
        }

        if ($settings !== null && self::registerMailer($settings['email'])) {
            $message->mailer(self::MAILER);

            if (filled($settings['email']['from_address'])) {
                $message->from($settings['email']['from_address'], $settings['email']['from_name'] ?: null);
            }
        }

        return $message;
    }

    /** Sends an already-built message through the store's saved SMTP settings when there are any. */
    public static function withStoreMailer(MailMessage $message, ?int $storeId): MailMessage
    {
        $settings = NotificationSetting::forStore($storeId);

        if ($settings !== null && self::registerMailer($settings['email'])) {
            $message->mailer(self::MAILER);

            if (filled($settings['email']['from_address'])) {
                $message->from($settings['email']['from_address'], $settings['email']['from_name'] ?: null);
            }
        }

        return $message;
    }

    /** Points a dedicated mailer at the store's SMTP server. False when no usable SMTP is saved. */
    public static function registerMailer(array $email): bool
    {
        if (! $email['enabled'] || blank($email['host'])) {
            return false;
        }

        config(['mail.mailers.'.self::MAILER => [
            'transport' => 'smtp',
            'scheme' => ($email['encryption'] ?? 'tls') === 'ssl' ? 'smtps' : 'smtp',
            'host' => $email['host'],
            'port' => (int) ($email['port'] ?: 587),
            'username' => $email['username'] ?: null,
            'password' => $email['password'] ?: null,
            'timeout' => 15,
        ]]);

        // The mail manager caches built mailers; a changed password must not be ignored.
        Mail::purge(self::MAILER);

        return true;
    }
}
