"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useGenerateSeo, useSeoAudit } from "@/hooks/use-seo-settings";
import { PermissionDenied } from "@/components/permission-denied";
import { SeoCard } from "@/components/seo/seo-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeoAuditCheck } from "@/types/seo-settings";

function scoreTone(score: number) {
  return score >= 81 ? "text-success" : score >= 51 ? "text-warning" : "text-danger";
}

function barTone(score: number) {
  return score >= 81 ? "bg-success" : score >= 51 ? "bg-warning" : "bg-danger";
}

function ScoreTile({ label, score, hint }: { label: string; score: number; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className={cn("mt-1 text-4xl font-semibold tabular-nums", scoreTone(score))}>{score}%</p>
      <p className="mt-1 text-xs text-text-muted">{hint}</p>
    </div>
  );
}

export default function SeoOverviewPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;
  const [overwrite, setOverwrite] = useState(false);
  const [confirm, setConfirm] = useState<string[] | null>(null);

  const { data: audit, isLoading } = useSeoAudit(storeId);
  const generate = useGenerateSeo(storeId ?? 0);

  if (currentUser && !can(currentUser, "seo.manage")) {
    return <PermissionDenied />;
  }

  function run(entities: string[]) {
    if (overwrite) {
      setConfirm(entities);
      return;
    }
    generate.mutate({ entities, overwrite: false });
  }

  const groups = audit
    ? Array.from(new Set(audit.checks.map((check) => check.group))).map((group) => ({
        group,
        checks: audit.checks.filter((check) => check.group === group),
      }))
    : [];

  return (
    <div className="space-y-6">
      {isLoading || !audit ? (
        <div className="grid gap-4 tablet:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 tablet:grid-cols-3">
          <ScoreTile label="Overall SEO health" score={audit.overall_score} hint="Average of site setup and content coverage" />
          <ScoreTile label="Site setup" score={audit.site_score} hint="Homepage, robots, sitemap, schema and integrations" />
          <ScoreTile label="Content coverage" score={audit.content_score} hint="How complete titles, descriptions and keywords are" />
        </div>
      )}

      <SeoCard
        title="Content SEO"
        description="Fill in missing SEO titles, meta descriptions and focus keywords from each item's own name, price and description. Anything you wrote by hand is left alone unless you tick the overwrite box."
        action={
          <Button
            type="button"
            loading={generate.isPending}
            onClick={() => run(audit?.entities.map((e) => e.key) ?? [])}
            disabled={!audit}
          >
            <Sparkles />
            Generate for everything
          </Button>
        }
      >
        <div className="flex items-start gap-3 rounded-md bg-shop-tint p-3">
          <Checkbox
            id="seo-overwrite"
            checked={overwrite}
            onCheckedChange={(value) => setOverwrite(value === true)}
            className="mt-0.5"
          />
          <div>
            <Label htmlFor="seo-overwrite" className="cursor-pointer font-medium">
              Replace existing SEO too
            </Label>
            <p className="text-xs text-text-muted">
              Off by default: only blank fields are filled. Turn on to regenerate everything, including text you wrote
              yourself.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="py-2 pr-4 font-medium">Content</th>
                <th className="py-2 pr-4 font-medium">With title</th>
                <th className="py-2 pr-4 font-medium">With description</th>
                <th className="py-2 pr-4 font-medium">With keyword</th>
                <th className="w-44 py-2 pr-4 font-medium">Good / needs work / poor</th>
                <th className="w-48 py-2 pr-4 font-medium">Average score</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {(audit?.entities ?? []).map((entity) => (
                <tr key={entity.key} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4 font-medium text-text-primary">
                    {entity.label}
                    <span className="ml-2 text-xs font-normal text-text-muted">{entity.total.toLocaleString("en-US")}</span>
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {entity.with_title.toLocaleString("en-US")}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{entity.with_description.toLocaleString("en-US")}</td>
                  <td className="py-3 pr-4 tabular-nums">{entity.with_focus_keyword.toLocaleString("en-US")}</td>
                  <td className="py-3 pr-4">
                    <div
                      className="flex h-2 w-full overflow-hidden rounded-full bg-border/60"
                      title={`${entity.good} good, ${entity.ok} need work, ${entity.poor} poor`}
                    >
                      {entity.total > 0 ? (
                        <>
                          <div className="bg-success" style={{ width: `${(entity.good / entity.total) * 100}%` }} />
                          <div className="bg-warning" style={{ width: `${(entity.ok / entity.total) * 100}%` }} />
                          <div className="bg-danger" style={{ width: `${(entity.poor / entity.total) * 100}%` }} />
                        </>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-text-muted">
                      {entity.good.toLocaleString("en-US")} / {entity.ok.toLocaleString("en-US")} / {entity.poor.toLocaleString("en-US")}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-border/60">
                        <div className={cn("h-full", barTone(entity.average_score))} style={{ width: `${entity.average_score}%` }} />
                      </div>
                      <span className={cn("w-10 text-right text-xs font-semibold tabular-nums", scoreTone(entity.average_score))}>
                        {entity.average_score}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={entity.total === 0 || generate.isPending}
                      onClick={() => run([entity.key])}
                    >
                      Generate
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SeoCard>

      {audit && audit.needs_attention.length > 0 ? (
        <SeoCard
          title="Needs attention"
          description="The lowest-scoring items. Open one, and the SEO panel lists exactly what to fix."
        >
          <ul className="divide-y divide-border">
            {audit.needs_attention.map((item) => (
              <li key={`${item.type}-${item.edit}`} className="flex items-center gap-3 py-2.5">
                <span className={cn("w-12 shrink-0 text-sm font-semibold tabular-nums", scoreTone(item.score))}>{item.score}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{item.name}</p>
                  <p className="text-xs text-text-muted">
                    {item.type}
                    {item.has_seo ? "" : " · no SEO yet"}
                  </p>
                </div>
                <Link href={item.edit} className="shrink-0 text-sm font-medium text-primary hover:underline">
                  Improve
                </Link>
              </li>
            ))}
          </ul>
        </SeoCard>
      ) : null}

      {groups.map(({ group, checks }) => (
        <SeoCard key={group} title={group} description={groupDescription(group)}>
          <ul className="divide-y divide-border">
            {checks.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </ul>
        </SeoCard>
      ))}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace existing SEO?</DialogTitle>
            <DialogDescription>
              This regenerates the SEO title, meta description and focus keyword for the selected content and replaces
              what is there now, including anything written by hand. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={generate.isPending}
              onClick={() => {
                if (confirm) {
                  generate.mutate({ entities: confirm, overwrite: true }, { onSuccess: () => setConfirm(null) });
                }
              }}
            >
              Replace existing SEO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function groupDescription(group: string): string {
  switch (group) {
    case "Homepage":
      return "What search engines and visitors see first. Fix these to improve how the homepage appears in results.";
    case "Blog page":
      return "The blog landing page, optimised separately from individual posts.";
    case "Site":
      return "Settings that apply across the whole site.";
    case "Technical":
      return "Crawling, indexing and structured data.";
    case "Integrations":
      return "Search engine ownership and analytics.";
    default:
      return "";
  }
}

function CheckRow({ check }: { check: SeoAuditCheck }) {
  return (
    <li className="flex items-start gap-3 py-3">
      {check.passed ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
      ) : (
        <Circle className="mt-0.5 size-5 shrink-0 text-text-muted" />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", check.passed ? "text-text-secondary" : "text-text-primary")}>{check.label}</p>
        {!check.passed ? <p className="text-xs text-text-muted">{check.hint}</p> : null}
      </div>
      {!check.passed ? (
        <Link href={check.fix} className="shrink-0 text-sm font-medium text-primary hover:underline">
          Fix
        </Link>
      ) : null}
    </li>
  );
}
