"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { useCurrentUser } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";
import {
  useCancelDeletion,
  useCreateExport,
  useDataSettings,
  useDownloadExport,
  useRequestDeletion,
} from "@/hooks/use-compliance";
import { useMyStores } from "@/hooks/use-auth";
import { PermissionDenied } from "@/components/permission-denied";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/types/api";

function size(bytes: number) {
  return bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "";
}

export default function DataSettingsPage() {
  const { data: user } = useCurrentUser();
  const { data: stores } = useMyStores();
  const { data, isLoading } = useDataSettings();
  const createExport = useCreateExport();
  const download = useDownloadExport();
  const requestDeletion = useRequestDeletion();
  const cancelDeletion = useCancelDeletion();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);

  if (user && !can(user, "settings.manage")) return <PermissionDenied />;
  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

  const slug = stores?.stores.find((s) => s.id === stores.current_store_id)?.slug ?? "";
  const closing = Boolean(data.deletion.requested_at);
  const deleteError = requestDeletion.error instanceof ApiError ? requestDeletion.error : null;
  const waitMinutes = Math.ceil(data.export_cooldown_seconds / 60);

  return (
    <div className="space-y-6">
      {closing ? (
        <Alert variant="warning">
          <AlertDescription>
            <strong>Your account is scheduled for deletion on {date(data.deletion.purge_at)}.</strong> Your store is offline. Until
            then you can cancel and everything comes back.
            {data.is_owner ? (
              <span className="mt-3 block">
                <Button variant="outline" size="sm" onClick={() => cancelDeletion.mutate()} disabled={cancelDeletion.isPending}>
                  {cancelDeletion.isPending ? "Cancelling…" : "Cancel deletion"}
                </Button>
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Download your data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-secondary">
            A zip of spreadsheet (CSV) files with your products, orders, customers and settings. Passwords and API keys are never
            included. Downloads stay available for a few days.
          </p>

          {data.is_owner ? (
            <Button onClick={() => createExport.mutate()} disabled={createExport.isPending || waitMinutes > 0}>
              {createExport.isPending ? "Preparing…" : waitMinutes > 0 ? `Available again in ${waitMinutes} min` : "Create an export"}
            </Button>
          ) : (
            <p className="text-sm text-text-secondary">Only the store owner can create exports.</p>
          )}

          {data.exports.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {data.exports.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>
                    Export from {date(row.created_at)} · {size(row.size)}
                    <span className="text-text-secondary"> · expires {date(row.expires_at)}</span>
                  </span>
                  {data.is_owner && row.downloadable ? (
                    <Button variant="outline" size="sm" onClick={() => download.mutate(row.id)} disabled={download.isPending}>
                      <Download className="size-4" /> Download
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {data.is_owner && !closing ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-danger">Delete your account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-text-secondary">
              Your store goes offline straight away. After {data.deletion.grace_days} days everything is permanently deleted:
              products, orders, customers and uploaded files. You can cancel any time before then. We keep invoices and payment
              records because the law requires it. Download an export first if you want a copy.
            </p>

            {!open ? (
              <Button variant="destructive" onClick={() => setOpen(true)}>
                Delete my account…
              </Button>
            ) : (
              <form
                className="max-w-md space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  requestDeletion.mutate({ password, confirm }, { onSuccess: () => { setPassword(""); setConfirm(""); setOpen(false); } });
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Type your store address ({slug}) to confirm</Label>
                  <Input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" error={Boolean(deleteError?.errors?.confirm)} />
                  {deleteError?.errors?.confirm ? <p className="text-xs text-danger">{deleteError.errors.confirm[0]}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Your password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" error={Boolean(deleteError?.errors?.password)} />
                  {deleteError?.errors?.password ? <p className="text-xs text-danger">{deleteError.errors.password[0]}</p> : null}
                </div>
                {deleteError && !deleteError.errors?.password && !deleteError.errors?.confirm ? (
                  <p className="text-xs text-danger">{deleteError.message}</p>
                ) : null}
                <div className="flex gap-2">
                  <Button type="submit" variant="destructive" disabled={requestDeletion.isPending || !password || !confirm}>
                    {requestDeletion.isPending ? "Scheduling…" : "Schedule deletion"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Keep my account
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
