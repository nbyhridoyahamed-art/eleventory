"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOnboarding } from "@/hooks/use-auth";

/**
 * First-run dashboard header: the free-trial banner and the "Get your store
 * ready" checklist, which ticks itself off from real data. The checklist is
 * hidden once every required step is done; the trial banner stays while a
 * trial is running.
 */
export function OnboardingChecklist() {
  const { data } = useOnboarding();

  if (!data) return null;

  const trial = data.trial;
  const showChecklist = data.total > 0 && data.completed < data.total;
  if (!trial && !showChecklist) return null;

  const percent = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
  const nextStep = data.steps.find((step) => !step.done && step.href);

  return (
    <div className="space-y-4">
      {trial ? (
        <Alert variant="warning">
          <AlertDescription>
            <strong>
              {trial.days_left} day{trial.days_left === 1 ? "" : "s"} left in your free trial.
            </strong>{" "}
            Your store stays online while the trial runs. <Link href="/dashboard/settings/billing" className="font-medium underline">Choose a plan</Link> before it ends to keep selling.
          </AlertDescription>
        </Alert>
      ) : null}

      {showChecklist ? (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Get your store ready</CardTitle>
                <p className="text-sm text-text-secondary">Finish these steps to start taking orders.</p>
              </div>
              <div className="w-full max-w-[260px]">
                <div className="mb-1.5 flex justify-between text-xs text-text-secondary">
                  <span>
                    {data.completed} of {data.total} done
                  </span>
                  <span>{percent}%</span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-border"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Setup progress"
                >
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {data.steps.map((step) => {
                const isNext = nextStep?.key === step.key;
                return (
                  <li key={step.key} className="flex items-center gap-3 py-3 text-sm">
                    {step.done ? (
                      <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Done" />
                    ) : (
                      <Circle
                        className={isNext ? "size-5 shrink-0 text-primary" : "size-5 shrink-0 text-text-muted"}
                        aria-label="To do"
                      />
                    )}
                    <span
                      className={
                        step.done
                          ? "flex-1 text-text-muted line-through"
                          : isNext
                            ? "flex-1 font-semibold text-text-primary"
                            : "flex-1 text-text-primary"
                      }
                    >
                      {step.label}
                    </span>
                    {step.href && !step.done ? (
                      <Link
                        href={step.href}
                        className={
                          isNext
                            ? "rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-on-primary hover:opacity-90"
                            : "rounded-md border border-border px-3.5 py-1.5 text-sm font-semibold text-text-primary hover:bg-background"
                        }
                      >
                        {isNext ? "Set up" : "Open"}
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
