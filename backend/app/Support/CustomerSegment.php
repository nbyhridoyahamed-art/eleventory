<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/**
 * Buckets a customer by buying behaviour. The same rules exist twice on
 * purpose: as PHP (label()) for what is shown, and as a SQL CASE
 * (caseSql()) so the list can filter and count by segment in the database.
 * Order of precedence: vip > inactive > at_risk > repeat > one_time > new.
 */
class CustomerSegment
{
    public const ALL = ['vip', 'repeat', 'one_time', 'at_risk', 'inactive', 'new'];

    public const LABELS = [
        'vip' => 'VIP',
        'repeat' => 'Repeat buyer',
        'one_time' => 'One-time buyer',
        'at_risk' => 'At risk',
        'inactive' => 'Inactive',
        'new' => 'No orders yet',
    ];

    /** Lifetime spend (minor units) or order count that makes a VIP. */
    public const VIP_SPEND_MINOR = 2_000_000; // 20,000.00

    public const VIP_ORDERS = 5;

    public const AT_RISK_DAYS = 60;

    public const INACTIVE_DAYS = 120;

    public static function label(int $orders, int $spendMinor, ?string $lastOrderAt, ?Carbon $now = null): string
    {
        $now ??= now();

        if ($orders === 0) {
            return 'new';
        }

        if ($spendMinor >= self::VIP_SPEND_MINOR || $orders >= self::VIP_ORDERS) {
            return 'vip';
        }

        $last = $lastOrderAt ? Carbon::parse($lastOrderAt) : null;

        if ($last && $last->lt($now->copy()->subDays(self::INACTIVE_DAYS))) {
            return 'inactive';
        }

        if ($orders >= 2 && $last && $last->lt($now->copy()->subDays(self::AT_RISK_DAYS))) {
            return 'at_risk';
        }

        return $orders >= 2 ? 'repeat' : 'one_time';
    }

    /** Correlated sub-selects over `customers`; "active" orders exclude cancelled ones. */
    public const ORDERS_SQL = "(SELECT COUNT(*) FROM orders o WHERE o.customer_id = customers.id AND o.status <> 'cancelled')";

    public const SPEND_SQL = "(SELECT COALESCE(SUM(oi.quantity * oi.unit_price_amount), 0) FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.customer_id = customers.id AND o.status <> 'cancelled')";

    public const LAST_SQL = "(SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = customers.id AND o.status <> 'cancelled')";

    /**
     * SQL CASE yielding the segment name, plus the bindings its `?`
     * placeholders need (in order).
     *
     * @return array{0: string, 1: array<int, mixed>}
     */
    public static function caseSql(?Carbon $now = null): array
    {
        $now ??= now();
        $inactive = $now->copy()->subDays(self::INACTIVE_DAYS)->toDateTimeString();
        $atRisk = $now->copy()->subDays(self::AT_RISK_DAYS)->toDateTimeString();

        $sql = 'CASE'
            .' WHEN '.self::ORDERS_SQL.' = 0 THEN \'new\''
            .' WHEN '.self::SPEND_SQL.' >= ? OR '.self::ORDERS_SQL.' >= ? THEN \'vip\''
            .' WHEN '.self::LAST_SQL.' < ? THEN \'inactive\''
            .' WHEN '.self::ORDERS_SQL.' >= 2 AND '.self::LAST_SQL.' < ? THEN \'at_risk\''
            .' WHEN '.self::ORDERS_SQL.' >= 2 THEN \'repeat\''
            .' ELSE \'one_time\' END';

        return [$sql, [self::VIP_SPEND_MINOR, self::VIP_ORDERS, $inactive, $atRisk]];
    }
}
