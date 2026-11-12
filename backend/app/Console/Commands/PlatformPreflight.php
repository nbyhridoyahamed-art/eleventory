<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * "Is this server ready for real merchants?" Read-only. Exit code 1 when anything marked FAIL is
 * found, so the go-live runbook (and CI) can gate on it. WARN items are judgement calls.
 */
class PlatformPreflight extends Command
{
    protected $signature = 'platform:preflight';

    protected $description = 'Check configuration and data for going live as a multi-tenant platform.';

    private int $failures = 0;

    public function handle(): int
    {
        $isProd = config('app.env') === 'production';

        $this->check('APP_ENV is production', $isProd, 'warn');
        $this->check('APP_DEBUG is off', ! config('app.debug'));
        $this->check('APP_KEY is set', (bool) config('app.key'));
        $this->check('Database reachable', $this->try(fn () => DB::select('select 1') !== []));
        $this->check('Migrations are up to date', $this->try(fn () => Schema::hasTable('legal_acceptances') && Schema::hasTable('data_exports') && Schema::hasTable('activity_logs')));

        $this->check('SAAS_MODE is on', (bool) config('app.saas_mode'));
        $this->check('PLATFORM_DOMAIN is set', (bool) config('app.platform_domain'));
        $this->check('Public sign-up is open (MERCHANT_SIGNUP) or invite codes are set', (bool) config('app.merchant_signup'), 'warn');
        $this->check('TLS_ASK_SECRET set (custom domains)', (bool) config('tenancy.tls_ask_secret'), 'warn');
        $this->check('PLATFORM_CNAME_TARGET set (custom domains)', (bool) config('tenancy.cname_target'), 'warn');

        $this->check('Mail is not logging to a file (MAIL_MAILER)', ! in_array(config('mail.default'), ['log', 'array'], true));
        $this->check('Queue is not "sync"', config('queue.default') !== 'sync', 'warn');
        $this->check('Backup key is separate from APP_KEY (BACKUP_ENCRYPTION_KEY)', (bool) config('backup.key'), 'warn');
        $this->check('Nightly per-shop exports on (BACKUP_TENANT_EXPORTS)', (bool) config('backup.tenant_exports'), 'warn');
        $this->check('Scheduler heartbeat required (HEALTH_REQUIRE_SCHEDULER)', (bool) config('health.require_scheduler'), 'warn');
        $this->check('Error tracking configured (SENTRY_LARAVEL_DSN)', (bool) env('SENTRY_LARAVEL_DSN'), 'warn');

        $this->check('Billing gateway is not "manual" or is deliberately manual (BILLING_GATEWAY)', config('billing.gateway') !== 'manual', 'warn');
        $this->check('Billing emails on (BILLING_EMAILS)', (bool) config('billing.send_emails'), 'warn');
        $this->check('Plans exist', $this->try(fn () => DB::table('plans')->count() > 0));
        $this->check('Plan prices are not placeholders (set real prices in the platform console)', false, 'warn', 'Prices in the seeded plans are placeholders; confirm them by hand.');

        $this->check('Legal pages: company details filled in', $this->legalFilled(), 'warn', 'Edit COMPANY in frontend/src/lib/legal-docs.ts and have a lawyer review the texts.');
        $this->check('LEGAL_VERSION is not a draft', ! str_contains((string) config('legal.version'), 'draft'), 'warn');

        $this->check('At least one platform admin', $this->try(fn () => DB::table('model_has_roles')->join('roles', 'roles.id', '=', 'model_has_roles.role_id')->where('roles.name', 'Platform Admin')->exists()));
        $this->check('Every shop belongs to an organization with a subscription', $this->try(fn () => DB::table('stores')->leftJoin('organizations', 'organizations.id', '=', 'stores.organization_id')->leftJoin('subscriptions', 'subscriptions.organization_id', '=', 'organizations.id')->whereNull('subscriptions.id')->doesntExist()));

        $this->newLine();
        $this->line($this->failures === 0 ? '<info>No blocking problems.</info> Read the WARN lines before launching.' : "<error>{$this->failures} blocking problem(s).</error>");

        return $this->failures === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function check(string $label, bool $ok, string $level = 'fail', ?string $hint = null): void
    {
        if ($ok) {
            $this->line("  <info>PASS</info>  {$label}");

            return;
        }

        if ($level === 'fail') {
            $this->failures++;
        }

        $this->line(($level === 'fail' ? '  <error>FAIL</error>  ' : '  <comment>WARN</comment>  ').$label.($hint ? "\n         {$hint}" : ''));
    }

    private function try(callable $fn): bool
    {
        try {
            return (bool) $fn();
        } catch (\Throwable) {
            return false;
        }
    }

    /** True once the frontend's legal text no longer contains the [bracketed] company placeholders. */
    private function legalFilled(): bool
    {
        $file = base_path('../frontend/src/lib/legal-docs.ts');

        return is_file($file) && ! preg_match('/:\s*"\[[^\]]+\]/', (string) file_get_contents($file));
    }
}
