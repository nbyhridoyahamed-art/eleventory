import type { ReactNode } from "react";
import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

/** The light-blue breadcrumb + title band that heads every storefront page. */
export function PageBanner({ title, crumbs, children }: { title: string; crumbs: Crumb[]; children?: ReactNode }) {
  return (
    <div className="bg-shop-tint">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-1 px-4 py-8 text-center">
        <nav aria-label="Breadcrumb" className="text-xs text-text-secondary">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`}>
              {index > 0 ? <span className="mx-1">/</span> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-shop-ink">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-text-primary">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
        <h1 className="text-page-title font-semibold text-text-primary">{title}</h1>
        {children}
      </div>
    </div>
  );
}
