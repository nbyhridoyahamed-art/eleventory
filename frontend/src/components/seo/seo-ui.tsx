"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** A titled box for one group of SEO settings. */
export function SeoCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          {description ? <p className="max-w-2xl text-sm text-text-secondary">{description}</p> : null}
        </div>
        {action}
      </header>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <div className="text-xs text-text-muted">{hint}</div> : null}
    </div>
  );
}

/** A labelled on/off switch row (checkbox with a description). */
export function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} className="mt-0.5" />
      <div className="space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer font-medium">
          {label}
        </Label>
        {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

function Counter({ value, range }: { value: string; range: [number, number] }) {
  const length = value.trim().length;
  const ok = length >= range[0] && length <= range[1];

  return (
    <span className={cn("text-xs", length === 0 ? "text-text-muted" : ok ? "text-success" : "text-warning")}>
      {length} characters (aim for {range[0]}–{range[1]})
    </span>
  );
}

export function CountedInput({
  id,
  value,
  onChange,
  range,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  range: [number, number];
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      <Counter value={value} range={range} />
    </div>
  );
}

export function CountedTextarea({
  id,
  value,
  onChange,
  range,
  placeholder,
  rows = 3,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  range: [number, number];
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      <Counter value={value} range={range} />
    </div>
  );
}

/** How a result would roughly look in Google, so wording can be judged before saving. */
export function SerpPreview({ title, description, url }: { title: string; description: string; url: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Search result preview</p>
      <p className="truncate text-xs text-text-secondary">{url}</p>
      <p className="truncate text-lg leading-snug text-info">{title || "Your page title appears here"}</p>
      <p className="line-clamp-2 text-sm text-text-secondary">
        {description || "Your meta description appears here. Write 120–160 characters that make people want to click."}
      </p>
    </div>
  );
}
