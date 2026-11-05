<?php

namespace App\Support\Tenancy;

use Illuminate\Support\Facades\Log;

/**
 * The store ("tenant") the current request or job is acting for.
 *
 * Set once per request by ResolveTenant (admin API, from the signed-in user's
 * membership), StorefrontController (public storefront) and EnsureCustomerUser
 * (customer account). While SAAS_MODE is on and a store is set, every model
 * that uses BelongsToStore is automatically limited to that store and stamped
 * with it on create. With no store set (console, queue workers, tests that
 * do not opt in) nothing is filtered.
 */
class TenantContext
{
    private ?int $storeId = null;

    private bool $bypass = false;

    public function set(?int $storeId): void
    {
        $this->storeId = $storeId;
    }

    public function storeId(): ?int
    {
        return $this->storeId;
    }

    public function forget(): void
    {
        $this->storeId = null;
        $this->bypass = false;
    }

    /** The store id to scope queries to, or null when tenancy is not in force. */
    public function activeStoreId(): ?int
    {
        if ($this->bypass || ! config('app.saas_mode')) {
            return null;
        }

        return $this->storeId;
    }

    /**
     * Run a callback with tenancy switched off - platform administration and
     * maintenance only. Every call site is deliberate and greppable.
     */
    public function withoutTenancy(callable $callback): mixed
    {
        $previous = $this->bypass;
        $this->bypass = true;

        // Every bypass leaves a trace: who asked, from where.
        $caller = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2)[1] ?? [];
        Log::info('tenancy.bypass', [
            'user_id' => auth()->id(),
            'caller' => ($caller['class'] ?? '').($caller['type'] ?? '').($caller['function'] ?? ''),
            'file' => $caller['file'] ?? null,
            'line' => $caller['line'] ?? null,
        ]);

        try {
            return $callback();
        } finally {
            $this->bypass = $previous;
        }
    }
}
