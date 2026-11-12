"use client";

import Link from "next/link";

import { useAbuseReports, useResolveReport } from "@/hooks/use-platform";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AbuseReportsPage() {
  const { data, isLoading } = useAbuseReports();
  const resolve = useResolveReport();

  if (isLoading || !data) return <Skeleton className="h-48 w-full" />;
  if (data.length === 0) return <p className="py-8 text-center text-sm text-text-secondary">No reports. Nice and quiet.</p>;

  return (
    <div className="space-y-3">
      {data.map((report) => (
        <Card key={report.id}>
          <CardContent className="space-y-2 pt-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={report.status === "open" ? "warning" : "neutral"}>{report.status}</Badge>
              <span className="font-semibold capitalize">{report.reason}</span>
              {report.store ? (
                <Link href={`/dashboard/platform/tenants/${report.store.id}`} className="text-primary hover:underline">{report.store.name}</Link>
              ) : <span className="text-text-secondary">shop unknown</span>}
              <span className="text-text-secondary">{report.created_at ? new Date(report.created_at).toLocaleString() : ""}</span>
            </div>
            {report.details ? <p>{report.details}</p> : null}
            {report.url ? <p className="break-all text-text-secondary">{report.url}</p> : null}
            {report.reporter_email ? <p className="text-text-secondary">Reporter: {report.reporter_email}</p> : null}
            {report.resolution_note ? <p className="text-text-secondary">Note: {report.resolution_note}</p> : null}
            {report.status === "open" ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {report.store ? (
                  <Button size="sm" disabled={resolve.isPending} onClick={() => { if (window.confirm(`Suspend ${report.store?.name} and close this report?`)) resolve.mutate({ id: report.id, status: "actioned", suspend_store: true }); }}>
                    Suspend shop
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: report.id, status: "actioned" })}>Mark handled</Button>
                <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: report.id, status: "dismissed" })}>Dismiss</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
