"use client";

import { useState } from "react";

import { useCurrentUser } from "@/hooks/use-auth";
import { useActivity } from "@/hooks/use-compliance";
import { can } from "@/lib/permissions";
import { PermissionDenied } from "@/components/permission-denied";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityPage() {
  const { data: user } = useCurrentUser();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useActivity(page);

  if (user && !can(user, "settings.manage")) return <PermissionDenied />;
  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-secondary">Important changes made in your dashboard: who did what, and when. Kept for a year.</p>

        {data.data.length === 0 ? (
          <p className="text-sm text-text-secondary">Nothing recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {data.data.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {entry.summary ?? entry.action}
                  <span className="text-text-secondary"> · {entry.user ? entry.user.name : "System"}</span>
                </span>
                <span className="text-xs text-text-secondary">{entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}</span>
              </li>
            ))}
          </ul>
        )}

        {data.meta.last_page > 1 ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-xs text-text-secondary">
              Page {data.meta.current_page} of {data.meta.last_page}
            </span>
            <Button variant="outline" size="sm" disabled={page >= data.meta.last_page} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
