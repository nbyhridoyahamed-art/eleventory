"use client";

import { useLiveAnnouncements } from "@/hooks/use-platform";
import { useMyStores } from "@/hooks/use-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAcceptLegal, useLegalStatus } from "@/hooks/use-compliance";

const LEVEL = { info: "info", warning: "warning", critical: "danger" } as const;

/**
 * Shown above every admin page: a platform admin who has stepped into someone else's shop sees
 * a persistent reminder (every action there is theirs, and entering was logged), and everyone
 * sees live platform announcements.
 */
export function PlatformBanners() {
  const { data: stores } = useMyStores();
  const { data: announcements } = useLiveAnnouncements();
  const current = stores?.stores.find((store) => store.id === stores.current_store_id);
  const legal = useLegalStatus();
  const accept = useAcceptLegal();

  return (
    <>
      {stores?.support_mode ? (
        <div className="border-b border-warning bg-warning/15 px-6 py-2 text-sm font-medium" role="status">
          Support mode: you are inside {current?.name ?? "another shop"} as a platform administrator. Your actions are recorded.
        </div>
      ) : null}
      {legal.data && legal.data.pending.length > 0 ? (
        <div className="px-6 pt-4">
          <Alert variant="info">
            <AlertDescription>
              <span className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  Our <a className="font-medium underline" href="/legal/terms" target="_blank" rel="noreferrer">Terms</a>,{" "}
                  <a className="font-medium underline" href="/legal/privacy" target="_blank" rel="noreferrer">Privacy Policy</a> and{" "}
                  <a className="font-medium underline" href="/legal/dpa" target="_blank" rel="noreferrer">Data Processing Agreement</a> were updated. Please review and accept them.
                </span>
                <Button size="sm" onClick={() => accept.mutate()} disabled={accept.isPending}>
                  {accept.isPending ? "Saving…" : "I accept"}
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      {(announcements ?? []).map((a) => (
        <div key={a.id} className="px-6 pt-4">
          <Alert variant={LEVEL[a.level]}>
            <AlertDescription>
              <strong>{a.title}</strong> {a.body}
            </AlertDescription>
          </Alert>
        </div>
      ))}
    </>
  );
}
