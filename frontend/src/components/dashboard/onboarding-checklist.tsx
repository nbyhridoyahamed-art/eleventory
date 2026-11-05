"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOnboarding } from "@/hooks/use-auth";

/**
 * "Get your store ready": ticks itself off from real data. Hidden once every
 * required step is done, and for stores that have nothing to onboard.
 */
export function OnboardingChecklist() {
  const { data } = useOnboarding();

  if (!data || data.total === 0 || data.completed >= data.total) return null;

  const percent = Math.round((data.completed / data.total) * 100);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Get your store ready</CardTitle>
          <span className="text-xs text-text-secondary">
            {data.completed} of {data.total} done
            {data.trial ? ` · ${data.trial.days_left} day${data.trial.days_left === 1 ? "" : "s"} left in your free trial` : ""}
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup progress"
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {data.steps.map((step) => (
            <li key={step.key} className="flex items-center gap-3 py-2.5 text-sm">
              {step.done ? (
                <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Done" />
              ) : (
                <Circle className="size-5 shrink-0 text-text-muted" aria-label="To do" />
              )}
              {step.href && !step.done ? (
                <Link href={step.href} className="font-medium text-primary hover:underline">
                  {step.label}
                </Link>
              ) : (
                <span className={step.done ? "text-text-muted line-through" : "text-text-primary"}>{step.label}</span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
