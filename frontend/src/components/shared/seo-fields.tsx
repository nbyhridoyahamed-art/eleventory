"use client";

import { useState } from "react";
import { CheckCircle2, Monitor, Plus, Smartphone, Trash2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-auth";
import { useSeoAnalysis, type SeoKind, type SeoTest } from "@/hooks/use-seo-analysis";
import { SEO_LEVEL_LABELS, seoLevel } from "@/lib/seo-score";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Seo } from "@/types/seo";

export interface SeoFaqItem {
  question: string;
  answer: string;
}

export interface SeoFieldsValue {
  title: string;
  description: string;
  focus_keyword: string;
  og_title: string;
  og_description: string;
  og_image: string;
  twitter_title: string;
  twitter_description: string;
  twitter_image: string;
  canonical_url: string;
  robots: string;
  /** Question & answer pairs, saved as FAQ structured data. */
  faq: SeoFaqItem[];
  /** schema.org types switched off for this item only (e.g. "BreadcrumbList"). */
  schema_off: string[];
}

export const EMPTY_SEO_FIELDS: SeoFieldsValue = {
  title: "",
  description: "",
  focus_keyword: "",
  og_title: "",
  og_description: "",
  og_image: "",
  twitter_title: "",
  twitter_description: "",
  twitter_image: "",
  canonical_url: "",
  robots: "",
  faq: [],
  schema_off: [],
};

/** `undefined`/`null` fields (or no `seo` at all, e.g. a new entity) fall back to an empty, editable form. */
export function seoToFieldsValue(seo: Seo | null | undefined): SeoFieldsValue {
  const rawFaq = seo?.schema_json && typeof seo.schema_json === "object" ? (seo.schema_json as { faq?: unknown }).faq : null;
  const faq = Array.isArray(rawFaq)
    ? rawFaq
        .filter((item): item is SeoFaqItem => Boolean(item) && typeof item === "object")
        .map((item) => ({ question: String(item.question ?? ""), answer: String(item.answer ?? "") }))
    : [];

  const rawOff = seo?.schema_json && typeof seo.schema_json === "object" ? (seo.schema_json as { disabled?: unknown }).disabled : null;
  const schemaOff = Array.isArray(rawOff) ? rawOff.filter((item): item is string => typeof item === "string") : [];

  return {
    title: seo?.title ?? "",
    description: seo?.description ?? "",
    focus_keyword: seo?.focus_keyword ?? "",
    og_title: seo?.og_title ?? "",
    og_description: seo?.og_description ?? "",
    og_image: seo?.og_image ?? "",
    twitter_title: seo?.twitter_title ?? "",
    twitter_description: seo?.twitter_description ?? "",
    twitter_image: seo?.twitter_image ?? "",
    canonical_url: seo?.canonical_url ?? "",
    robots: seo?.robots ?? "",
    faq,
    schema_off: schemaOff,
  };
}

/** Blank fields are sent as `null` (clears any existing override) rather than omitted. */
export function seoFieldsToPayload(value: SeoFieldsValue): Record<string, string | Record<string, unknown> | null> {
  const { faq, schema_off, ...fields } = value;
  const faqItems = faq.filter((item) => item.question.trim() && item.answer.trim());

  return {
    ...Object.fromEntries(Object.entries(fields).map(([key, fieldValue]) => [key, fieldValue === "" ? null : fieldValue])),
    schema_json:
      faqItems.length > 0 || schema_off.length > 0
        ? { ...(faqItems.length > 0 ? { faq: faqItems } : {}), ...(schema_off.length > 0 ? { disabled: schema_off } : {}) }
        : null,
  };
}

// ---- robots directives -----------------------------------------------------

interface RobotsFlags {
  noindex: boolean;
  nofollow: boolean;
  noarchive: boolean;
  nosnippet: boolean;
}

function parseRobots(value: string): RobotsFlags {
  const parts = value.toLowerCase().split(/[\s,]+/);
  return {
    noindex: parts.includes("noindex"),
    nofollow: parts.includes("nofollow"),
    noarchive: parts.includes("noarchive"),
    nosnippet: parts.includes("nosnippet"),
  };
}

function buildRobots(flags: RobotsFlags): string {
  return (Object.keys(flags) as (keyof RobotsFlags)[]).filter((key) => flags[key]).join(", ");
}

// ---- small pieces ----------------------------------------------------------

const GROUP_ORDER = ["Basic SEO", "Title & Description", "Additional", "Title Readability", "Content Readability"];

const PATHS: Record<SeoKind, string> = {
  product: "/products/",
  page: "/pages/",
  post: "/blog/",
  category: "/category/",
  brand: "/brand/",
  blog_category: "/blog/category/",
  blog_tag: "/blog/tag/",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function ScoreRing({ score, className }: { score: number; className?: string }) {
  const level = seoLevel(score);
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const colour = level === "good" ? "text-success" : level === "ok" ? "text-warning" : "text-danger";

  return (
    <div className={cn("relative size-[72px] shrink-0", colour, className)} role="img" aria-label={`SEO score ${score} out of 100`}>
      <svg viewBox="0 0 72 72" className="size-full -rotate-90">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="7" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums">{score}</span>
    </div>
  );
}

function Counter({ value, range }: { value: string; range: [number, number] }) {
  const length = value.trim().length;
  const inRange = length >= range[0] && length <= range[1];

  return (
    <span className={cn("text-xs", length === 0 ? "text-text-muted" : inRange ? "text-success" : "text-warning")}>
      {length} characters (aim for {range[0]}–{range[1]})
    </span>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function SerpPreview({ title, description, url, mobile }: { title: string; description: string; url: string; mobile: boolean }) {
  return (
    <div className={cn("rounded-md border border-border bg-background p-4", mobile && "mx-auto max-w-[360px]")}>
      <p className="truncate text-xs text-text-secondary">{url}</p>
      <p className={cn("mt-0.5 leading-snug text-info", mobile ? "line-clamp-2 text-base" : "truncate text-lg")}>
        {truncate(title, 60) || "Your SEO title appears here"}
      </p>
      <p className={cn("mt-1 text-sm text-text-secondary", mobile ? "line-clamp-4" : "line-clamp-2")}>
        {truncate(description, 160) || "Your meta description appears here."}
      </p>
    </div>
  );
}

function TestGroup({ group, tests }: { group: string; tests: SeoTest[] }) {
  const failed = tests.filter((test) => !test.passed).length;

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border bg-shop-tint px-3 py-2">
        <p className="text-sm font-semibold text-text-primary">{group}</p>
        <span className={cn("text-xs font-medium", failed === 0 ? "text-success" : "text-warning")}>
          {failed === 0 ? "All passed" : `${failed} to fix`}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {[...tests].sort((a, b) => Number(a.passed) - Number(b.passed)).map((test) => (
          <li key={test.id} className="flex items-start gap-2.5 px-3 py-2.5">
            {test.passed ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Passed" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Needs work" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{test.label}</p>
              <p className="text-xs text-text-muted">{test.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- the editor panel ------------------------------------------------------

export interface SeoAnalysisContext {
  kind: SeoKind;
  /** The item's URL slug (the page path after /products/, /blog/ ...). */
  slug: string;
  /** The item's main text (HTML or plain) — what the content tests read. */
  content: string;
  /** Existing item id, so a keyword is not reported as "used elsewhere" because of itself. */
  entityId?: number | null;
  /** Alt text of the item's images (blank entries count as missing). */
  images?: string[];
}

interface SeoFieldsProps {
  value: SeoFieldsValue;
  onChange: (value: SeoFieldsValue) => void;
  /** Falls back to this when Title/Description are left blank — e.g. the entity's own name and excerpt. */
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
  /** Item details for the on-page analysis; without it only the title/description/keyword tests are meaningful. */
  analysis?: SeoAnalysisContext;
}

type Tab = "general" | "social" | "advanced" | "schema";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "social", label: "Social" },
  { id: "advanced", label: "Advanced" },
  { id: "schema", label: "Schema" },
];

const MAX_FAQ = 10;

/** What the storefront outputs automatically for each kind of item (site-wide switches live in SEO → Technical). */
const AUTO_SCHEMA: Record<SeoKind, { type: string; label: string; hint: string }[]> = {
  product: [
    { type: "Product", label: "Product", hint: "Name, images, SKU, price and availability — makes the item eligible for rich results." },
    { type: "BreadcrumbList", label: "Breadcrumbs", hint: "Home › Category › Product trail shown in search results." },
  ],
  post: [
    { type: "Article", label: "Article", hint: "Headline, image and publish date for the blog post." },
    { type: "BreadcrumbList", label: "Breadcrumbs", hint: "Home › Blog › Category › Post trail." },
  ],
  page: [{ type: "BreadcrumbList", label: "Breadcrumbs", hint: "Home › Page trail shown in search results." }],
  category: [{ type: "BreadcrumbList", label: "Breadcrumbs", hint: "Home › Category trail shown in search results." }],
  brand: [{ type: "BreadcrumbList", label: "Breadcrumbs", hint: "Home › Brand trail shown in search results." }],
  blog_category: [{ type: "BreadcrumbList", label: "Breadcrumbs", hint: "Home › Blog › Category trail." }],
  blog_tag: [{ type: "BreadcrumbList", label: "Breadcrumbs", hint: "Home › Blog › Tag trail." }],
};

export function SeoFields({ value, onChange, titlePlaceholder, descriptionPlaceholder, analysis }: SeoFieldsProps) {
  const { data: currentUser } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("general");
  const [mobilePreview, setMobilePreview] = useState(false);

  const set = <K extends keyof SeoFieldsValue>(key: K, fieldValue: SeoFieldsValue[K]) => onChange({ ...value, [key]: fieldValue });

  const kind = analysis?.kind ?? "page";
  const effectiveTitle = value.title || titlePlaceholder || "";
  const effectiveDescription = value.description || descriptionPlaceholder || "";

  const { data: result, isFetching } = useSeoAnalysis(currentUser?.current_store_id, {
    kind,
    entityId: analysis?.entityId ?? null,
    title: value.title,
    description: value.description,
    keyword: value.focus_keyword,
    slug: analysis?.slug ?? "",
    content: analysis?.content ?? "",
    images: analysis?.images,
  });

  const robots = parseRobots(value.robots);
  const setRobots = (patch: Partial<RobotsFlags>) => set("robots", buildRobots({ ...robots, ...patch }));

  const url = `${SITE_URL}${PATHS[kind]}${analysis?.slug ?? ""}`;
  const groups = GROUP_ORDER.map((group) => ({ group, tests: (result?.tests ?? []).filter((test) => test.group === group) })).filter(
    (g) => g.tests.length > 0,
  );
  const passed = (result?.tests ?? []).filter((test) => test.passed).length;
  const total = result?.tests.length ?? 0;
  const score = result?.score ?? 0;
  const level = seoLevel(score);

  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className="flex items-center gap-4 rounded-md border border-border bg-shop-tint p-4">
        <ScoreRing score={score} className={cn(isFetching && "opacity-60")} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">
            SEO score: {SEO_LEVEL_LABELS[level]}
            {isFetching ? <span className="ml-2 text-xs font-normal text-text-muted">updating…</span> : null}
          </p>
          <p className="text-xs text-text-secondary">
            {total > 0 ? `${passed} of ${total} checks passed. ` : ""}
            {level === "good" ? "Nice work." : "Work through the failed checks below to raise it."}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="SEO sections" className="flex gap-1 border-b border-border">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === item.id
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "general" ? (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="seo-focus-keyword">Focus keyword</Label>
            <Input
              id="seo-focus-keyword"
              value={value.focus_keyword}
              placeholder="e.g. wireless earbuds"
              onChange={(event) => set("focus_keyword", event.target.value)}
            />
            <p className="text-xs text-text-muted">
              The phrase you want this page to rank for. The first one is scored; extra keywords can follow, separated by commas.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-primary">Search result preview</p>
              <div className="flex gap-1" role="group" aria-label="Preview device">
                <button
                  type="button"
                  aria-pressed={!mobilePreview}
                  aria-label="Desktop preview"
                  onClick={() => setMobilePreview(false)}
                  className={cn("rounded-md p-1.5", !mobilePreview ? "bg-primary/10 text-primary" : "text-text-muted hover:text-text-primary")}
                >
                  <Monitor className="size-4" />
                </button>
                <button
                  type="button"
                  aria-pressed={mobilePreview}
                  aria-label="Mobile preview"
                  onClick={() => setMobilePreview(true)}
                  className={cn("rounded-md p-1.5", mobilePreview ? "bg-primary/10 text-primary" : "text-text-muted hover:text-text-primary")}
                >
                  <Smartphone className="size-4" />
                </button>
              </div>
            </div>
            <SerpPreview title={effectiveTitle} description={effectiveDescription} url={url} mobile={mobilePreview} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seo-title">SEO title</Label>
            <Input
              id="seo-title"
              value={value.title}
              placeholder={titlePlaceholder}
              onChange={(event) => set("title", event.target.value)}
            />
            <Counter value={value.title} range={[30, 60]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seo-description">Meta description</Label>
            <Textarea
              id="seo-description"
              rows={3}
              value={value.description}
              placeholder={descriptionPlaceholder}
              onChange={(event) => set("description", event.target.value)}
            />
            <Counter value={value.description} range={[120, 160]} />
          </div>

          <div className="space-y-3">
            {groups.length === 0 ? (
              <p className="text-sm text-text-muted">{isFetching ? "Analysing…" : "Add a focus keyword to start the analysis."}</p>
            ) : (
              groups.map(({ group, tests }) => <TestGroup key={group} group={group} tests={tests} />)
            )}
          </div>
        </div>
      ) : null}

      {tab === "social" ? (
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-medium text-text-primary">Facebook / WhatsApp (Open Graph)</p>
            <div className="space-y-1.5">
              <Label htmlFor="seo-og-title">Title</Label>
              <Input id="seo-og-title" value={value.og_title} placeholder={effectiveTitle} onChange={(event) => set("og_title", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-og-description">Description</Label>
              <Textarea
                id="seo-og-description"
                rows={2}
                value={value.og_description}
                placeholder={effectiveDescription}
                onChange={(event) => set("og_description", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-og-image">Image URL</Label>
              <Input id="seo-og-image" value={value.og_image} placeholder="https://..." onChange={(event) => set("og_image", event.target.value)} />
              <p className="text-xs text-text-muted">1200 × 630 pixels works best.</p>
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium text-text-primary">X (Twitter)</p>
            <div className="space-y-1.5">
              <Label htmlFor="seo-twitter-title">Title</Label>
              <Input id="seo-twitter-title" value={value.twitter_title} onChange={(event) => set("twitter_title", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-twitter-description">Description</Label>
              <Textarea
                id="seo-twitter-description"
                rows={2}
                value={value.twitter_description}
                onChange={(event) => set("twitter_description", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seo-twitter-image">Image URL</Label>
              <Input id="seo-twitter-image" value={value.twitter_image} onChange={(event) => set("twitter_image", event.target.value)} />
            </div>
          </div>
        </div>
      ) : null}

      {tab === "advanced" ? (
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-medium text-text-primary">Robots meta</p>
            <p className="text-xs text-text-muted">Leave everything off to let search engines index this page and follow its links (the default).</p>
            {(
              [
                ["noindex", "No index", "Keep this page out of search results."],
                ["nofollow", "No follow", "Don't pass ranking credit to links on this page."],
                ["noarchive", "No archive", "Don't show a cached copy of the page."],
                ["nosnippet", "No snippet", "Don't show a text or video snippet in results."],
              ] as const
            ).map(([key, label, hint]) => (
              <div key={key} className="flex items-start gap-3">
                <Checkbox
                  id={`seo-robots-${key}`}
                  checked={robots[key]}
                  onCheckedChange={(checked) => setRobots({ [key]: checked === true })}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor={`seo-robots-${key}`} className="cursor-pointer font-medium">
                    {label}
                  </Label>
                  <p className="text-xs text-text-muted">{hint}</p>
                </div>
              </div>
            ))}
            {robots.noindex ? (
              <p className="rounded-md bg-warning/10 p-2 text-xs text-warning">
                This page will not appear in Google. Make sure that is what you want.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5 border-t border-border pt-4">
            <Label htmlFor="seo-canonical-url">Canonical URL</Label>
            <Input
              id="seo-canonical-url"
              placeholder={url}
              value={value.canonical_url}
              onChange={(event) => set("canonical_url", event.target.value)}
            />
            <p className="text-xs text-text-muted">Only set this when the same content exists at another address you prefer.</p>
          </div>
        </div>
      ) : null}

      {tab === "schema" ? (
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-text-primary">Automatic schema</p>
              <p className="text-xs text-text-muted">
                Added to this page for you. Turn one off to leave it out for this item only; site-wide switches are in
                SEO → Technical.
              </p>
            </div>
            {AUTO_SCHEMA[kind].map((item) => (
              <div key={item.type} className="flex items-start gap-3 rounded-md border border-border p-3">
                <Checkbox
                  id={`seo-schema-${item.type}`}
                  checked={!value.schema_off.includes(item.type)}
                  onCheckedChange={(checked) =>
                    set(
                      "schema_off",
                      checked === true ? value.schema_off.filter((t) => t !== item.type) : [...value.schema_off, item.type],
                    )
                  }
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor={`seo-schema-${item.type}`} className="cursor-pointer font-medium">
                    {item.label} <span className="font-mono text-xs font-normal text-text-muted">{item.type}</span>
                  </Label>
                  <p className="text-xs text-text-muted">{item.hint}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium text-text-primary">FAQ schema</p>
            <p className="text-xs text-text-muted">
              Add questions and answers customers ask. They are added as FAQ structured data, which can earn expandable
              answers in search results.
            </p>
          </div>

          {value.faq.map((item, index) => (
            <div key={index} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-text-secondary">Question {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove question ${index + 1}`}
                  onClick={() => set("faq", value.faq.filter((_, i) => i !== index))}
                >
                  <Trash2 className="text-danger" />
                </Button>
              </div>
              <Input
                aria-label={`Question ${index + 1}`}
                value={item.question}
                placeholder="What is the warranty?"
                onChange={(event) => set("faq", value.faq.map((f, i) => (i === index ? { ...f, question: event.target.value } : f)))}
              />
              <Textarea
                aria-label={`Answer ${index + 1}`}
                rows={2}
                value={item.answer}
                placeholder="Write a clear, short answer."
                onChange={(event) => set("faq", value.faq.map((f, i) => (i === index ? { ...f, answer: event.target.value } : f)))}
              />
            </div>
          ))}

          <Button type="button" variant="outline" disabled={value.faq.length >= MAX_FAQ} onClick={() => set("faq", [...value.faq, { question: "", answer: "" }])}>
            <Plus />
            Add question
          </Button>
        </div>
      ) : null}
    </div>
  );
}
