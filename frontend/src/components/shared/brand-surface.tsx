"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";

/**
 * Applies the Eleventory brand look (teal, coral, Bricolage and Figtree) to everything inside, and to
 * portals (dialogs, menus, toasts) that render on <body>. Storefront pages never mount this, so a
 * shop keeps its own theme and the single-store site is unchanged.
 */
export function BrandSurface({
  fontClassName,
  className,
  children,
}: {
  fontClassName: string;
  className?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const classes = ["surface-brand", ...fontClassName.split(" ").filter(Boolean)];
    document.body.classList.add(...classes);

    return () => document.body.classList.remove(...classes);
  }, [fontClassName]);

  return <div className={cn("surface-brand min-h-screen", fontClassName, className)}>{children}</div>;
}
