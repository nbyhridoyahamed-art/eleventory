"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { usePaymentGateways, useSavePaymentGateway, type PaymentGateway } from "@/hooks/use-payment-gateways";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

function GatewayCard({ gateway }: { gateway: PaymentGateway }) {
  const save = useSavePaymentGateway();
  const [enabled, setEnabled] = useState(gateway.is_enabled);
  const [testMode, setTestMode] = useState(gateway.test_mode);
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">{gateway.label}</div>
            <div className="text-xs text-text-secondary">{gateway.description}</div>
          </div>
          {gateway.is_enabled ? (
            <Badge variant={gateway.test_mode ? "warning" : "success"}>{gateway.test_mode ? "On · test mode" : "On · live"}</Badge>
          ) : (
            <Badge variant="neutral">Off</Badge>
          )}
        </div>

        {gateway.fields.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {gateway.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`${gateway.key}-${field.key}`}>{field.label}</Label>
                <Input
                  id={`${gateway.key}-${field.key}`}
                  type={field.secret ? "password" : "text"}
                  autoComplete="off"
                  placeholder={field.saved ? "Saved. Type to replace." : ""}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        ) : null}

        {gateway.key !== "fake" ? (
          <div className="space-y-1.5">
            <Label htmlFor={`${gateway.key}-hook`}>{gateway.key === "stripe" ? "Webhook endpoint (add it in your Stripe dashboard)" : "IPN / notification URL"}</Label>
            <div className="flex gap-2">
              <Input id={`${gateway.key}-hook`} readOnly value={gateway.webhook_url} />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(gateway.webhook_url);
                  toast.success("Copied.");
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-5 text-sm text-text-secondary">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Offer at checkout
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} /> Test mode (no real money moves)
            </label>
          </div>
          <Button
            loading={save.isPending}
            onClick={() => save.mutate({ provider: gateway.key, is_enabled: enabled, test_mode: testMode, credentials: values }, { onSuccess: () => setValues({}) })}
          >
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PaymentsSettingsPage() {
  const { data: currentUser } = useCurrentUser();
  const { data: gateways, isLoading } = usePaymentGateways();

  if (currentUser && !can(currentUser, "settings.manage")) return <PermissionDenied />;

  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-sm text-text-secondary">
        Money from online payments goes straight to your own accounts. Keys are stored encrypted and never shown again.
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

      {isLoading ? <Skeleton className="h-48 w-full" /> : (gateways ?? []).map((gateway) => <GatewayCard key={`${gateway.key}-${gateway.is_enabled}-${gateway.test_mode}`} gateway={gateway} />)}

      <p className="rounded-md border border-info/30 bg-info/5 px-4 py-3 text-sm text-info">
        Online payments are included from the Growth plan. <Link href="/dashboard/settings/billing" className="font-semibold underline">See plans</Link>
      </p>
    </div>
  );
}
