import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The storefront's bordered content box: a tinted uppercase title strip over
 * the body. Used by the account pages (and mirrors the checkout's sections).
 */
export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("border border-border bg-surface", className)}>
      {title || action ? (
        <header className="flex items-center justify-between gap-3 border-b border-border bg-shop-tint px-5 py-3">
          {title ? <h2 className="text-sm font-semibold uppercase tracking-wide text-text-primary">{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Shared class names for the storefront's square primary/secondary buttons. */
export const SHOP_BUTTON_PRIMARY =
  "rounded-none bg-shop-accent text-xs font-semibold uppercase tracking-wide text-shop-on-accent hover:bg-shop-accent-hover";
