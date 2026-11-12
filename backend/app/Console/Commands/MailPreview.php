<?php

namespace App\Console\Commands;

use App\Notifications\BillingNoticeNotification;
use App\Notifications\ServiceNoticeNotification;
use Illuminate\Console\Command;
use Illuminate\Notifications\AnonymousNotifiable;

/** Renders each transactional email to an HTML file so wording and layout can be reviewed without sending anything. */
class MailPreview extends Command
{
    protected $signature = 'mail:preview {--out= : Folder to write into (default storage/app/mail-preview)}';

    protected $description = 'Render the platform emails to HTML files for review.';

    public function handle(): int
    {
        $dir = $this->option('out') ?: storage_path('app/mail-preview');
        @mkdir($dir, 0755, true);
        $who = (new AnonymousNotifiable)->route('mail', 'owner@example.test');

        $samples = [
            'deletion-requested' => new ServiceNoticeNotification('Your account will be deleted', ['You asked us to delete your account. Your store is now offline.', 'Everything will be permanently deleted on Dec 1, 2026. Until then you can change your mind and bring it all back.'], 'Review or cancel', '/dashboard/settings/data'),
            'deletion-cancelled' => new ServiceNoticeNotification('Account deletion cancelled', ['Your account will not be deleted. Your store is back online.'], 'Open dashboard', '/dashboard'),
            'export-ready' => new ServiceNoticeNotification('Your data export is ready', ['The export of your store is ready to download. It stays available for 7 days.'], 'Download export', '/dashboard/settings/data'),
            'billing-notice' => new BillingNoticeNotification('Your trial ends soon', ['Your free trial ends in 3 days. Choose a plan to keep your store online.']),
        ];

        foreach ($samples as $name => $notification) {
            $html = (string) $notification->toMail($who)->render();
            file_put_contents("{$dir}/{$name}.html", $html);
            $this->line("{$dir}/{$name}.html");
        }

        return self::SUCCESS;
    }
}
