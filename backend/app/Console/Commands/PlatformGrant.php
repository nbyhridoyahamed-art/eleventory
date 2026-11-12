<?php

namespace App\Console\Commands;

use App\Models\PlatformAuditLog;
use App\Models\User;
use Illuminate\Console\Command;
use Spatie\Permission\Models\Role;

class PlatformGrant extends Command
{
    protected $signature = 'platform:grant {email : An existing staff user} {--revoke : Take the role away instead}';

    protected $description = 'Make a user a platform administrator (can see and manage every shop), or revoke it.';

    public function handle(): int
    {
        $user = User::where('email', $this->argument('email'))->first();

        if (! $user) {
            $this->error('No user with that email.');

            return self::FAILURE;
        }

        Role::findOrCreate('Platform Admin', 'web');

        if ($this->option('revoke')) {
            $user->removeRole('Platform Admin');
            $this->info("{$user->email} is no longer a platform admin.");
        } else {
            $user->assignRole('Platform Admin');
            $this->info("{$user->email} is now a platform admin.");
        }

        PlatformAuditLog::record(null, $this->option('revoke') ? 'platform.revoke' : 'platform.grant', null, ['email' => $user->email]);

        return self::SUCCESS;
    }
}
