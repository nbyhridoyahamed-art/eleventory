import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PreviewNotice } from "@/components/shared/preview-notice";

export const metadata = { title: "Billing" };

const USAGE = [
  { label: "Products", used: 38, limit: 100 },
  { label: "Staff accounts", used: 2, limit: 3 },
  { label: "Orders this month", used: 470, limit: 500 },
];

const PLANS = [
  { name: "Starter", recommended: false },
  { name: "Growth", recommended: true },
  { name: "Pro", recommended: false },
];

function Meter({ used, limit }: { used: number; limit: number }) {
  const percent = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-border"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={percent >= 90 ? "h-full bg-danger" : "h-full bg-primary"} style={{ width: `${percent}%` }} />
    </div>
  );
}

export default function BillingSettingsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <PreviewNotice>Plans, prices and limits are placeholders until they are confirmed.</PreviewNotice>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">Free trial</span>
              <Badge variant="warning">9 days left</Badge>
            </div>
            <p className="text-sm text-text-secondary">
              Pick a plan before your trial ends to keep your store online. Nothing is charged until you do.
            </p>
            <Meter used={5} limit={14} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 pt-6">
            <div className="text-xs text-text-secondary">Payment method</div>
            <div className="font-semibold">None added yet</div>
            <Button variant="outline" size="sm" disabled>Add payment method</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Usage this month</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-6 sm:grid-cols-3">
            {USAGE.map((u) => (
              <div key={u.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{u.label}</span>
                  <span className={u.used / u.limit >= 0.9 ? "font-semibold text-danger" : "text-text-secondary"}>
                    {u.used} / {u.limit}
                  </span>
                </div>
                <Meter used={u.used} limit={u.limit} />
              </div>
            ))}
          </div>
          <p className="text-sm text-danger">You are close to your order limit. Upgrade to keep taking orders without interruption.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.name} className={plan.recommended ? "border-2 border-primary" : undefined}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-2 font-semibold">
                {plan.name}
                {plan.recommended ? <Badge variant="primary">Recommended</Badge> : null}
              </div>
              <div className="text-2xl font-bold">৳[PRICE]<span className="text-sm font-medium text-text-secondary"> /mo</span></div>
              <Button variant={plan.recommended ? "primary" : "outline"} className="w-full" disabled>
                Choose {plan.name}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent className="py-8 text-center text-sm text-text-secondary">
          No invoices yet. They will appear here once you start a paid plan.
        </CardContent>
      </Card>
    </div>
  );
}
