import type { ReactNode } from "react";

/** The homepage's shared section title: bold ink text with an accent bar, and an optional right-hand slot. */
export function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="border-l-4 border-shop-accent pl-3 text-xl font-bold leading-tight text-shop-ink tablet:text-2xl">
        {title}
      </h2>
      {children}
    </div>
  );
}
