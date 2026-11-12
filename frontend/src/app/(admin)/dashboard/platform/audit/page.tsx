"use client";

import { useAuditLog } from "@/hooks/use-platform";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLogPage() {
  const { data, isLoading } = useAuditLog();

  if (isLoading || !data) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-background text-left text-text-secondary">
          <tr>
            {["When", "Who", "Action", "Shop", "Details"].map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.id} className="border-t border-border align-top">
              <td className="whitespace-nowrap px-4 py-3 text-text-secondary">{entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}</td>
              <td className="px-4 py-3">{entry.actor ?? "system"}</td>
              <td className="px-4 py-3 font-mono text-xs">{entry.action}</td>
              <td className="px-4 py-3">{entry.store?.name ?? "—"}</td>
              <td className="px-4 py-3 text-xs text-text-secondary">{entry.meta ? JSON.stringify(entry.meta) : ""}</td>
            </tr>
          ))}
          {data.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-text-secondary">Nothing recorded yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
