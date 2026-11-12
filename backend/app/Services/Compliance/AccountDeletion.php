<?php

namespace App\Services\Compliance;

use App\Models\DataExport;
use App\Models\Media;
use App\Models\Organization;
use App\Models\PlatformAuditLog;
use App\Models\Store;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\ServiceNoticeNotification;
use App\Services\Tenancy\TenantBackup;
use App\Support\MediaLibrary;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Closing an account, in three steps.
 *
 *  1. request(): the owner asks. Shops go offline (reason "deletion"), renewals stop, and a grace
 *     period starts (config compliance.deletion_grace_days). Nothing is deleted yet.
 *  2. cancel(): the owner changes their mind inside the grace period; everything comes back.
 *  3. purge(): once the grace period is over the shop data and uploaded files are deleted for good.
 *
 * What is kept, and why: invoices and the organization row (renamed "Deleted account", contact
 * details removed) because accounting records must be kept; legal_acceptances (proof of what was
 * agreed); platform audit log entries. Staff accounts that belong to no other shop are anonymised.
 */
class AccountDeletion
{
    public function __construct(private TenantBackup $backup) {}

    public function request(Organization $organization, User $by): Organization
    {
        if ($organization->purged_at) {
            throw new RuntimeException('This account has already been deleted.');
        }

        if ($organization->deletion_requested_at) {
            return $organization;
        }

        DB::transaction(function () use ($organization) {
            $organization->forceFill(['deletion_requested_at' => now()])->save();

            // Only shops that are live; ones already closed for billing or by the platform keep their own reason.
            Store::where('organization_id', $organization->id)->where('status', 'active')
                ->update(['status' => 'suspended', 'suspension_reason' => 'deletion']);

            // No renewal while the account is closing.
            Subscription::where('organization_id', $organization->id)->whereIn('status', [Subscription::ACTIVE, Subscription::TRIALING, Subscription::PAST_DUE])
                ->update(['cancel_at_period_end' => true, 'pending_plan_id' => null]);
        });

        $this->notify($organization, 'Your account will be deleted', [
            'You asked us to delete your account. Your store is now offline.',
            'Everything will be permanently deleted on '.$this->purgeDate($organization->refresh())->toFormattedDateString().'. Until then you can change your mind and bring it all back.',
            'If you want a copy of your data, download an export before that date.',
        ], 'Review or cancel', '/dashboard/settings/data');

        PlatformAuditLog::record($by, 'account.deletion_requested', null, ['organization_id' => $organization->id]);

        return $organization->refresh();
    }

    public function cancel(Organization $organization, User $by): Organization
    {
        if ($organization->purged_at) {
            throw new RuntimeException('This account has already been deleted and cannot be restored.');
        }

        if (! $organization->deletion_requested_at) {
            return $organization;
        }

        DB::transaction(function () use ($organization) {
            $organization->forceFill(['deletion_requested_at' => null])->save();

            Store::where('organization_id', $organization->id)->where('status', 'suspended')->where('suspension_reason', 'deletion')
                ->update(['status' => 'active', 'suspension_reason' => null]);

            Subscription::where('organization_id', $organization->id)->where('status', '!=', Subscription::CANCELLED)
                ->update(['cancel_at_period_end' => false]);
        });

        $this->notify($organization, 'Account deletion cancelled', ['Your account will not be deleted. Your store is back online.'], 'Open dashboard', '/dashboard');
        PlatformAuditLog::record($by, 'account.deletion_cancelled', null, ['organization_id' => $organization->id]);

        return $organization->refresh();
    }

    public function purgeDate(Organization $organization): Carbon
    {
        return $organization->deletion_requested_at->copy()->addDays((int) config('compliance.deletion_grace_days'));
    }

    /** Accounts whose grace period is over. */
    public function due(): Collection
    {
        return Organization::whereNotNull('deletion_requested_at')->whereNull('purged_at')
            ->where('deletion_requested_at', '<=', now()->subDays((int) config('compliance.deletion_grace_days')))
            ->get();
    }

    /**
     * Delete the account's data for good. Idempotent: a second call does nothing.
     *
     * @return array<string, int>
     */
    public function purge(Organization $organization): array
    {
        if ($organization->purged_at || ! $organization->deletion_requested_at) {
            return [];
        }

        $stores = Store::withoutGlobalScopes()->where('organization_id', $organization->id)->get();
        $storeIds = $stores->pluck('id')->all();
        $userIds = $storeIds ? DB::table('store_user')->whereIn('store_id', $storeIds)->pluck('user_id')->unique()->all() : [];
        $summary = ['stores' => $stores->count(), 'users_anonymised' => 0];

        foreach ($stores as $store) {
            $this->deleteFiles($store);
        }

        // One shop at a time so a failure leaves the others (and this one) intact and the purge can be re-run.
        foreach ($stores as $store) {
            Schema::disableForeignKeyConstraints();

            try {
                DB::transaction(function () use ($store) {
                    if (DB::connection()->getDriverName() === 'sqlite') {
                        DB::statement('PRAGMA defer_foreign_keys = ON');
                    }

                    DB::table('users')->where('current_store_id', $store->id)->update(['current_store_id' => null]);
                    $this->backup->wipeStore($store->id);
                });
            } finally {
                Schema::enableForeignKeyConstraints();
            }

            // Last, with foreign keys on: platform notes cascade, audit/abuse rows keep their text and lose the link.
            DB::table('stores')->where('id', $store->id)->delete();
        }

        $summary['users_anonymised'] = $this->anonymiseOrphans($userIds);

        DB::transaction(function () use ($organization) {
            $organization->forceFill([
                'name' => 'Deleted account',
                'email' => null,
                'phone' => null,
                'status' => 'deleted',
                'purged_at' => now(),
            ])->save();

            Subscription::where('organization_id', $organization->id)->update(['status' => Subscription::CANCELLED, 'cancel_at_period_end' => false]);
        });

        PlatformAuditLog::record(null, 'account.purged', null, ['organization_id' => $organization->id] + $summary);

        return $summary;
    }

    /** Uploaded files and generated exports are outside the database, so they need their own cleanup. */
    private function deleteFiles(Store $store): void
    {
        Media::withoutGlobalScopes()->where('store_id', $store->id)->select(['disk', 'path'])->cursor()->each(function ($media) {
            try {
                Storage::disk($media->disk)->delete($media->path);
            } catch (\Throwable $e) {
                report($e);
            }
        });

        try {
            Storage::disk(MediaLibrary::disk())->deleteDirectory(MediaLibrary::TENANT_PREFIX.$store->uuid);
            Storage::disk('local')->deleteDirectory('exports/'.$store->uuid);
        } catch (\Throwable $e) {
            report($e);
        }

        DataExport::withoutGlobalScopes()->where('store_id', $store->id)->delete();
    }

    /** People who belonged only to the deleted shops lose their personal details; the row stays so records that point at it still resolve. */
    private function anonymiseOrphans(array $userIds): int
    {
        $count = 0;

        foreach (User::whereIn('id', $userIds)->get() as $user) {
            $stillMember = DB::table('store_user')->where('user_id', $user->id)->exists();

            if ($stillMember || $user->hasRole('Platform Admin')) {
                continue;
            }

            $user->tokens()->delete();
            $user->syncRoles([]);
            $user->forceFill([
                'name' => 'Deleted user',
                'email' => 'deleted-'.$user->id.'-'.Str::lower(Str::random(6)).'@deleted.invalid',
                'phone' => null,
                'password' => Hash::make(Str::random(40)),
                'remember_token' => null,
                'email_verified_at' => null,
            ])->save();
            $count++;
        }

        return $count;
    }

    private function notify(Organization $organization, string $subject, array $lines, string $label, string $path): void
    {
        if (! config('compliance.send_emails') || ! $organization->email) {
            return;
        }

        try {
            Notification::route('mail', $organization->email)->notify(new ServiceNoticeNotification($subject, $lines, $label, $path));
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
