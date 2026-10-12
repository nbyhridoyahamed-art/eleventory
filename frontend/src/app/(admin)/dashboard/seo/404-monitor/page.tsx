"use client";

import { useState } from "react";
import { ArrowRightLeft, SearchX, Trash2 } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useCreateRedirect } from "@/hooks/use-redirects";
import { useClearNotFound, useDeleteNotFound, useNotFoundLog, type NotFoundEntry } from "@/hooks/use-seo-tools";
import { PermissionDenied } from "@/components/permission-denied";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NotFoundMonitorPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<NotFoundEntry | null>(null);
  const [toPath, setToPath] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const { data: entries, isLoading } = useNotFoundLog(storeId, search);
  const createRedirect = useCreateRedirect();
  const deleteEntry = useDeleteNotFound(storeId ?? 0);
  const clearLog = useClearNotFound(storeId ?? 0);

  if (currentUser && !can(currentUser, "seo.manage")) {
    return <PermissionDenied />;
  }

  function openRedirect(entry: NotFoundEntry) {
    setTarget(entry);
    setToPath("/");
  }

  function submitRedirect() {
    if (!target || !storeId) return;

    createRedirect.mutate(
      { store_id: storeId, from_path: target.path, to_path: toPath.trim(), status_code: 301 },
      {
        onSuccess: () => {
          deleteEntry.mutate(target.id);
          setTarget(null);
        },
      },
    );
  }

  const columns: DataTableColumn<NotFoundEntry>[] = [
    {
      id: "path",
      header: "Missing URL",
      cell: (entry) => <span className="break-all font-medium">{entry.path}</span>,
    },
    { id: "hits", header: "Hits", cell: (entry) => entry.hits.toLocaleString("en-US") },
    {
      id: "referrer",
      header: "Last referrer",
      cell: (entry) => <span className="break-all text-text-secondary">{entry.last_referrer || "Direct"}</span>,
    },
    {
      id: "last_seen_at",
      header: "Last seen",
      cell: (entry) => new Date(entry.last_seen_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (entry) => (
        <div className="flex justify-end gap-1">
          <Button type="button" size="sm" variant="outline" onClick={() => openRedirect(entry)}>
            <ArrowRightLeft />
            Redirect
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Dismiss ${entry.path}`}
            onClick={() => deleteEntry.mutate(entry.id)}
          >
            <Trash2 className="text-danger" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-secondary">
          Pages visitors and search engines tried to open but couldn&apos;t find. Send the busy ones to the right page
          with a 301 redirect so the traffic and ranking aren&apos;t lost.
        </p>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Search missing URLs"
            placeholder="Search URLs…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-56"
          />
          <Button
            type="button"
            variant="outline"
            disabled={!entries || entries.length === 0}
            onClick={() => setConfirmClear(true)}
          >
            Clear log
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={entries ?? []}
        rowKey={(entry) => entry.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={<SearchX />}
            title="No 404s recorded"
            description="Great — nobody has hit a missing page. New broken URLs will show up here automatically."
          />
        }
      />

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create redirect</DialogTitle>
            <DialogDescription>
              Visitors who open <span className="break-all font-medium">{target?.path}</span> will be sent to the address
              below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="redirect-to">Redirect to</Label>
            <Input
              id="redirect-to"
              value={toPath}
              placeholder="/products/example"
              onChange={(event) => setToPath(event.target.value)}
            />
            <p className="text-xs text-text-muted">A path on this store (starting with /) or a full URL.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button loading={createRedirect.isPending} disabled={toPath.trim() === ""} onClick={submitRedirect}>
              Create 301 redirect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear the 404 log?</DialogTitle>
            <DialogDescription>
              Every recorded missing URL is removed. Ones that are still being requested will reappear.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={clearLog.isPending}
              onClick={() => clearLog.mutate(undefined, { onSuccess: () => setConfirmClear(false) })}
            >
              Clear log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
