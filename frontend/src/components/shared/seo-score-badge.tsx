import { cn } from "@/lib/utils";
import { SEO_LEVEL_LABELS, seoLevel, seoScoreValue, type SeoLike } from "@/lib/seo-score";

const LEVEL_STYLES = {
  good: "bg-success/10 text-success",
  ok: "bg-warning/10 text-warning",
  poor: "bg-danger/10 text-danger",
} as const;

/**
 * A compact SEO score chip for list rows: the 0–100 on-page score from the
 * backend analyzer, coloured green (81+), amber (51–80) or red.
 */
export function SeoScoreBadge({ seo, className }: { seo: SeoLike | null | undefined; className?: string }) {
  const score = seoScoreValue(seo);
  const level = seoLevel(score);

  return (
    <span
      title={`SEO score ${score}/100 — ${SEO_LEVEL_LABELS[level]}. Open the item and use its SEO tab to see what to improve.`}
      aria-label={`SEO score ${score} out of 100, ${SEO_LEVEL_LABELS[level]}`}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
        LEVEL_STYLES[level],
        className,
      )}
    >
      {score}
      <span className="text-[10px] font-medium opacity-70">/100</span>
    </span>
  );
}
