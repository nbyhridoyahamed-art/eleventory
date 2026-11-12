<?php

namespace App\Services\Billing;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Store;
use App\Models\Subscription;
use App\Notifications\BillingNoticeNotification;
use App\Services\Billing\Gateways\BillingGateway;
use App\Services\Billing\Gateways\FakeGateway;
use App\Services\Billing\Gateways\ManualGateway;
use App\Services\Billing\Gateways\PaymentResult;
use App\Services\Billing\Gateways\SslCommerzGateway;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Subscription lifecycle: trial -> active -> past_due -> suspended -> cancelled.
 *
 * Money is only ever believed after the gateway has confirmed it (see handlePayment), and
 * every state change is idempotent, so a webhook delivered twice or a command run twice
 * does no harm.
 */
class BillingService
{
    public function __construct(private PlanLimits $limits) {}

    public function gateway(): BillingGateway
    {
        return match (config('billing.gateway')) {
            'sslcommerz' => new SslCommerzGateway,
            'fake' => new FakeGateway,
            default => new ManualGateway,
        };
    }

    // ---- starting out -------------------------------------------------------------------

    /** A new account: a free trial on the trial plan's limits. */
    public function startTrial(Organization $organization): Subscription
    {
        $plan = Plan::where('key', config('billing.trial_plan', 'growth'))->first() ?? Plan::purchasable()->first();

        if (! $plan) {
            throw new \RuntimeException('No plans are set up yet.');
        }

        return Subscription::updateOrCreate(['organization_id' => $organization->id], [
            'plan_id' => $plan->id,
            'status' => Subscription::TRIALING,
            'billing_cycle' => 'monthly',
            'trial_ends_at' => $organization->trial_ends_at,
        ]);
    }

    // ---- choosing a plan ----------------------------------------------------------------

    /**
     * Pick a plan. Returns the invoice to pay, or null when the change needs no payment
     * (a downgrade scheduled for the end of the period).
     *
     * @throws ValidationException
     */
    public function subscribe(Organization $organization, Plan $plan, string $cycle): ?Invoice
    {
        if (! in_array($cycle, ['monthly', 'yearly'], true)) {
            $this->fail('cycle', 'Choose monthly or yearly billing.');
        }

        if (! $plan->is_public || ! $plan->is_active) {
            $this->fail('plan', 'That plan is not available.');
        }

        $subscription = $this->subscriptionFor($organization);
        $now = now();
        $running = $subscription->status === Subscription::ACTIVE
            && $subscription->current_period_end && $subscription->current_period_end->isFuture();

        if ($running && $subscription->plan_id === $plan->id && $subscription->billing_cycle === $cycle) {
            $this->fail('plan', 'You are already on this plan.');
        }

        $price = (float) $plan->priceFor($cycle);
        $amount = $price;
        $description = "{$plan->name} plan, ".($cycle === 'yearly' ? 'one year' : 'one month');

        if ($running) {
            $current = $subscription->plan;
            $isUpgrade = $price > (float) $current->priceFor($subscription->billing_cycle) || $cycle === 'yearly' && $subscription->billing_cycle === 'monthly';

            if (! $isUpgrade) {
                // Downgrade or a shorter cycle: keep what was paid for, switch when it ends.
                if ($over = $this->limits->overages($organization, $plan)) {
                    $this->fail('plan', 'You are using more than the '.$plan->name.' plan allows ('.implode(', ', array_map(fn ($r, $v) => "{$r}: {$v['used']}/{$v['limit']}", array_keys($over), $over)).'). Reduce usage first.');
                }

                $subscription->update(['pending_plan_id' => $plan->id]);

                return null;
            }

            // Upgrade now, credited for the unused part of the period already paid.
            $amount = max(0, round($price - $this->unusedCredit($subscription), 2));
            $description = "Upgrade to {$plan->name} (".($cycle === 'yearly' ? 'yearly' : 'monthly').')';
        }

        // Asking again for the same thing reuses its open invoice instead of piling up new ones.
        $invoice = Invoice::where('organization_id', $organization->id)->where('status', Invoice::OPEN)
            ->where('plan_id', $plan->id)->where('billing_cycle', $cycle)->latest('id')->first();

        $invoice ??= $this->createInvoice($organization, $subscription, $plan, $cycle, $amount, $description);

        // A fully credited upgrade costs nothing: apply it straight away.
        if ((float) $invoice->amount <= 0) {
            $this->markPaid($invoice, ['credit' => true]);
        }

        return $invoice->refresh();
    }

    /** The payment page for an open invoice (null when payment is by manual transfer). */
    public function checkoutUrl(Invoice $invoice): ?string
    {
        if (! $invoice->isOpen()) {
            $this->fail('invoice', 'This invoice is not waiting for payment.');
        }

        $gateway = $this->gateway();
        $invoice->forceFill(['gateway' => $gateway->name()])->save();

        return $gateway->checkoutUrl($invoice, $invoice->organization()->firstOrFail());
    }

    public function cancel(Organization $organization): Subscription
    {
        $subscription = $this->subscriptionFor($organization);
        $subscription->update(['cancel_at_period_end' => true, 'pending_plan_id' => null]);

        return $subscription->refresh();
    }

    public function resume(Organization $organization): Subscription
    {
        $subscription = $this->subscriptionFor($organization);

        if ($subscription->status === Subscription::CANCELLED) {
            $this->fail('subscription', 'This subscription has ended. Choose a plan to start again.');
        }

        $subscription->update(['cancel_at_period_end' => false]);

        return $subscription->refresh();
    }

    // ---- payments -----------------------------------------------------------------------

    /**
     * A provider callback for one of our invoices. The gateway has already verified it with the
     * provider; here it must also match what we asked to be paid.
     */
    public function handlePayment(PaymentResult $result): ?Invoice
    {
        $invoice = Invoice::where('tran_id', $result->tranId)->first();

        if (! $invoice) {
            Log::warning('billing.payment.unknown_invoice', ['tran_id' => $result->tranId]);

            return null;
        }

        if (! $result->paid) {
            $invoice->forceFill(['gateway_payload' => $result->raw])->save();

            return $invoice;
        }

        // Never activate on a wrong amount or currency, whatever the provider reports.
        if (abs((float) $result->amount - (float) $invoice->amount) > 0.009 || strtoupper($result->currency) !== strtoupper($invoice->currency)) {
            Log::warning('billing.payment.amount_mismatch', ['invoice' => $invoice->number, 'paid' => $result->amount, 'expected' => (string) $invoice->amount]);

            return $invoice;
        }

        return $this->markPaid($invoice, $result->raw);
    }

    /** Record a payment and put the account on the invoice's plan. Safe to call twice. */
    public function markPaid(Invoice $invoice, array $payload = []): Invoice
    {
        return DB::transaction(function () use ($invoice, $payload) {
            $invoice = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            if ($invoice->status === Invoice::PAID) {
                return $invoice;
            }

            $organization = $invoice->organization()->firstOrFail();
            $subscription = $this->subscriptionFor($organization);
            $plan = $invoice->plan()->firstOrFail();
            $cycle = $invoice->billing_cycle;
            $now = now();

            // Renewing a period that has not run out yet continues from its end; otherwise start now.
            $start = $subscription->status === Subscription::ACTIVE && $subscription->current_period_end?->isFuture() && $subscription->plan_id === $plan->id
                ? $subscription->current_period_end
                : $now;

            $subscription->forceFill([
                'plan_id' => $plan->id,
                'pending_plan_id' => null,
                'status' => Subscription::ACTIVE,
                'billing_cycle' => $cycle,
                'current_period_start' => $start,
                'current_period_end' => $this->periodEnd($start, $cycle),
                'grace_ends_at' => null,
                'cancel_at_period_end' => false,
                'cancelled_at' => null,
                'gateway' => $invoice->gateway,
            ])->save();

            $invoice->forceFill([
                'status' => Invoice::PAID,
                'paid_at' => $now,
                'period_start' => $subscription->current_period_start,
                'period_end' => $subscription->current_period_end,
                'gateway_payload' => $payload ?: $invoice->gateway_payload,
            ])->save();

            $organization->forceFill(['plan' => $plan->key])->save();
            $this->reopenStores($organization);
            $this->limits->flush();

            $this->notify($organization, "Payment received: {$invoice->number}", [
                "Thank you. We received {$invoice->currency} {$invoice->amount} for your {$plan->name} plan.",
                'Your plan is active until '.$subscription->current_period_end->toFormattedDateString().'.',
            ]);

            return $invoice;
        });
    }

    /**
     * Platform admins only: put an account on a plan with no payment (a comp, a deal, a fix).
     * Trialing runs for $days (default: the trial length); active runs for $days (default one month).
     */
    public function override(Organization $organization, Plan $plan, string $status, ?int $days = null): Subscription
    {
        $subscription = $this->subscriptionFor($organization);
        $now = now();

        $attributes = ['plan_id' => $plan->id, 'pending_plan_id' => null, 'status' => $status, 'grace_ends_at' => null, 'cancel_at_period_end' => false, 'cancelled_at' => null];

        if ($status === Subscription::TRIALING) {
            $attributes['trial_ends_at'] = $now->copy()->addDays($days ?? (int) config('app.trial_days', 14));
        } else {
            $attributes += ['current_period_start' => $now, 'current_period_end' => $now->copy()->addDays($days ?? 30)];
        }

        $subscription->forceFill($attributes)->save();
        $organization->forceFill(['plan' => $plan->key])->save();
        $this->reopenStores($organization);
        $this->limits->flush();

        return $subscription;
    }

    // ---- the daily clock ----------------------------------------------------------------

    /**
     * Move every account forward in time: end trials, issue renewal invoices, apply the
     * grace period, suspend, send reminders. Run daily; running it again changes nothing.
     *
     * @return array<string, int>
     */
    public function runLifecycle(?Carbon $now = null): array
    {
        $now ??= now();
        $done = ['trial_ended' => 0, 'renewals' => 0, 'suspended' => 0, 'cancelled' => 0, 'reminders' => 0];

        // 1. Trials that have run out.
        Subscription::where('status', Subscription::TRIALING)->where('trial_ends_at', '<=', $now)->each(function (Subscription $s) use ($now, &$done) {
            $organization = $s->organization()->firstOrFail();

            if ($s->cancel_at_period_end) {
                $this->endSubscription($s, $organization, $now);
                $done['cancelled']++;

                return;
            }

            $s->update(['status' => Subscription::PAST_DUE, 'grace_ends_at' => $now->copy()->addDays((int) config('billing.grace_days', 3))]);
            $this->notify($organization, 'Your free trial has ended', [
                'Choose a plan to keep your store online.',
                'Your store stays open until '.$s->grace_ends_at->toFormattedDateString().'.',
            ]);
            $done['trial_ended']++;
        });

        // 2. Paid periods that have run out.
        Subscription::where('status', Subscription::ACTIVE)->whereNotNull('current_period_end')->where('current_period_end', '<=', $now)->each(function (Subscription $s) use ($now, &$done) {
            $organization = $s->organization()->firstOrFail();

            if ($s->cancel_at_period_end) {
                $this->endSubscription($s, $organization, $now);
                $done['cancelled']++;

                return;
            }

            if ($s->pending_plan_id) {
                $s->update(['plan_id' => $s->pending_plan_id, 'pending_plan_id' => null]);
                $s->refresh();
            }

            $plan = $s->plan()->firstOrFail();
            $invoice = $this->openRenewalInvoice($organization, $s, $plan);
            $s->update(['status' => Subscription::PAST_DUE, 'grace_ends_at' => $now->copy()->addDays((int) config('billing.grace_days', 3))]);

            $this->notify($organization, "Invoice {$invoice->number} is ready", [
                "Your {$plan->name} plan renewal is {$invoice->currency} {$invoice->amount}.",
                'Pay it to keep your store online. Your store stays open until '.$s->grace_ends_at->toFormattedDateString().'.',
            ]);
            $done['renewals']++;
        });

        // 3. Grace periods that have run out: the shops go offline.
        Subscription::where('status', Subscription::PAST_DUE)->where('grace_ends_at', '<=', $now)->each(function (Subscription $s) use (&$done) {
            $organization = $s->organization()->firstOrFail();
            $s->update(['status' => Subscription::SUSPENDED]);
            $this->suspendStores($organization);
            $this->notify($organization, 'Your store is offline', ['We could not find a payment, so your store is offline. Pay your open invoice or choose a plan to bring it back.']);
            $done['suspended']++;
        });

        // 4. Reminders before a trial or paid period ends (sent once per day-mark).
        foreach ((array) config('billing.reminder_days', [3, 1]) as $days) {
            $day = $now->copy()->addDays($days)->toDateString();

            Subscription::whereIn('status', [Subscription::TRIALING, Subscription::ACTIVE])
                ->where(fn ($q) => $q->whereDate('trial_ends_at', $day)->orWhereDate('current_period_end', $day))
                ->each(function (Subscription $s) use ($days, &$done) {
                    if (! cache()->add("billing:reminder:{$s->id}:{$s->status}:{$days}:".($s->trial_ends_at ?? $s->current_period_end)->toDateString(), 1, now()->addDays(10))) {
                        return;
                    }

                    $this->notify($s->organization()->firstOrFail(), "Your plan ends in {$days} day".($days === 1 ? '' : 's'), ['Choose or renew a plan so your store stays online.']);
                    $done['reminders']++;
                });
        }

        $this->limits->flush();

        return $done;
    }

    // ---- helpers ------------------------------------------------------------------------

    private function subscriptionFor(Organization $organization): Subscription
    {
        return Subscription::where('organization_id', $organization->id)->first() ?? $this->startTrial($organization);
    }

    private function createInvoice(Organization $organization, Subscription $subscription, Plan $plan, string $cycle, float $amount, string $description): Invoice
    {
        return DB::transaction(function () use ($organization, $subscription, $plan, $cycle, $amount, $description) {
            $invoice = Invoice::create([
                'organization_id' => $organization->id,
                'subscription_id' => $subscription->id,
                'plan_id' => $plan->id,
                'number' => 'TMP-'.Str::random(12),
                'status' => Invoice::OPEN,
                'billing_cycle' => $cycle,
                'amount' => number_format($amount, 2, '.', ''),
                'currency' => $plan->currency,
                'description' => $description,
                'due_at' => now()->addDays((int) config('billing.grace_days', 3)),
                'gateway' => config('billing.gateway'),
                'tran_id' => 'EL'.strtoupper(Str::random(20)),
            ]);

            $invoice->forceFill(['number' => sprintf('%s-%s-%05d', config('billing.invoice_prefix', 'INV'), now()->format('Y'), $invoice->id)])->save();

            return $invoice;
        });
    }

    private function openRenewalInvoice(Organization $organization, Subscription $subscription, Plan $plan): Invoice
    {
        $existing = Invoice::where('organization_id', $organization->id)->where('status', Invoice::OPEN)->where('plan_id', $plan->id)->latest('id')->first();

        return $existing ?? $this->createInvoice(
            $organization, $subscription, $plan, $subscription->billing_cycle,
            (float) $plan->priceFor($subscription->billing_cycle),
            "{$plan->name} plan renewal, ".($subscription->billing_cycle === 'yearly' ? 'one year' : 'one month'),
        );
    }

    /** Value of the unused part of the paid period, to credit against an upgrade. */
    private function unusedCredit(Subscription $subscription): float
    {
        $paid = Invoice::where('subscription_id', $subscription->id)->where('status', Invoice::PAID)->latest('paid_at')->first();

        if (! $paid || ! $subscription->current_period_start || ! $subscription->current_period_end) {
            return 0.0;
        }

        $total = max(1, $subscription->current_period_start->diffInSeconds($subscription->current_period_end));
        $left = max(0, now()->diffInSeconds($subscription->current_period_end, false));

        return round((float) $paid->amount * min(1, $left / $total), 2);
    }

    private function periodEnd(Carbon $start, string $cycle): Carbon
    {
        return $cycle === 'yearly' ? $start->copy()->addYear() : $start->copy()->addMonth();
    }

    private function endSubscription(Subscription $s, Organization $organization, Carbon $now): void
    {
        $s->update(['status' => Subscription::CANCELLED, 'cancelled_at' => $now, 'cancel_at_period_end' => false]);
        $this->suspendStores($organization);
        $this->notify($organization, 'Your subscription has ended', ['Your store is offline. You can choose a plan any time to bring it back.']);
    }

    /** Take the account's shops offline because of billing (platform suspensions are left alone). */
    public function suspendStores(Organization $organization): void
    {
        Store::where('organization_id', $organization->id)->where('status', 'active')
            ->update(['status' => 'suspended', 'suspension_reason' => 'billing']);
    }

    /** Reopen only the shops billing closed. */
    public function reopenStores(Organization $organization): void
    {
        Store::where('organization_id', $organization->id)->where('status', 'suspended')->where('suspension_reason', 'billing')
            ->update(['status' => 'active', 'suspension_reason' => null]);
    }

    private function notify(Organization $organization, string $subject, array $lines): void
    {
        if (! config('billing.send_emails') || ! $organization->email) {
            return;
        }

        Notification::route('mail', $organization->email)->notify(new BillingNoticeNotification($subject, $lines));
    }

    /** @throws ValidationException */
    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => [$message]]);
    }
}
