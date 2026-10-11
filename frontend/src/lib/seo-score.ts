/**
 * Score helpers shared by the SEO editor and the score badge in list screens.
 *
 * The 0–100 score itself is computed by the backend analyzer (SeoAnalyzer), so
 * the editor, lists and dashboard always agree. This module only turns a score
 * into a level and keeps the original five-rule checklist as a fallback for
 * the rare item that has SEO fields but has not been analysed yet.
 */

export interface SeoLike {
  title?: string | null;
  description?: string | null;
  focus_keyword?: string | null;
  score?: number | null;
}

export type SeoLevel = "good" | "ok" | "poor";

/** Matches SeoAnalyzer::GOOD / ::OK on the backend (Rank Math's own bands). */
export const SEO_GOOD = 81;
export const SEO_OK = 51;

export function seoLevel(score: number): SeoLevel {
  return score >= SEO_GOOD ? "good" : score >= SEO_OK ? "ok" : "poor";
}

export const SEO_LEVEL_LABELS: Record<SeoLevel, string> = {
  good: "Good",
  ok: "Needs work",
  poor: "Poor",
};

export interface SeoRule {
  label: string;
  passed: boolean;
}

/** The five basic checks; used only when no stored score exists yet. */
export function seoRules(seo: SeoLike | null | undefined): SeoRule[] {
  const title = (seo?.title ?? "").trim();
  const description = (seo?.description ?? "").trim();
  const keyword = (seo?.focus_keyword ?? "").trim().toLowerCase();

  return [
    { label: `Title length is 30–60 characters (currently ${title.length})`, passed: title.length >= 30 && title.length <= 60 },
    {
      label: `Meta description length is 120–160 characters (currently ${description.length})`,
      passed: description.length >= 120 && description.length <= 160,
    },
    { label: "A focus keyword is set", passed: keyword.length > 0 },
    { label: "Focus keyword appears in the title", passed: keyword.length > 0 && title.toLowerCase().includes(keyword) },
    {
      label: "Focus keyword appears in the meta description",
      passed: keyword.length > 0 && description.toLowerCase().includes(keyword),
    },
  ];
}

/** The 0–100 score for a row: the stored analyzer score when present, else the basic rules scaled to 100. */
export function seoScoreValue(seo: SeoLike | null | undefined): number {
  if (typeof seo?.score === "number") return seo.score;
  if (!seo) return 0;

  const rules = seoRules(seo);
  return Math.round((rules.filter((rule) => rule.passed).length / rules.length) * 100);
}
