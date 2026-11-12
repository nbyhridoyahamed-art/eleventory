import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PreviewNotice } from "@/components/shared/preview-notice";

export const metadata = { title: "Payments" };

export default function PaymentsSettingsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <PreviewNotice />
      <p className="text-sm text-text-secondary">
        Money from online payments goes straight to your own accounts. Keys are stored securely and never shown again.
      </p>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div>
            <div className="font-semibold">Cash on delivery</div>
            <div className="text-xs text-text-secondary">Shoppers pay the courier when the order arrives.</div>
          </div>
          <Badge variant="success">On</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold">SSLCommerz</div>
              <div className="text-xs text-text-secondary">Cards, bKash, Nagad and bank payments.</div>
            </div>
            <Badge variant="success">Connected · test mode</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sslc-id">Store ID</Label>
              <Input id="sslc-id" defaultValue="rahim6a1f…" readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sslc-pass">Store password</Label>
              <Input id="sslc-pass" type="password" placeholder="Saved. Type to replace." readOnly />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" defaultChecked disabled className="size-4" /> Use test mode (no real money moves)
            </label>
            <div className="flex gap-2">
              <Button variant="outline" disabled>Send test payment</Button>
              <Button disabled>Save</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div>
            <div className="font-semibold">bKash</div>
            <div className="text-xs text-text-secondary">Take payments directly with your bKash merchant account.</div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="neutral">Not connected</Badge>
            <Button variant="outline" disabled>Connect</Button>
          </div>
        </CardContent>
      </Card>

      <p className="rounded-md border border-info/30 bg-info/5 px-4 py-3 text-sm text-info">
        Online payments are included from the Growth plan. <Link href="/dashboard/settings/billing" className="font-semibold underline">See plans</Link>
      </p>
    </div>
  );
}
