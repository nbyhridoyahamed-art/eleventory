import { Eye } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * "View" button for admin list rows: opens the item's public storefront page in
 * a new tab. When the item isn't publicly visible (draft, inactive ...) it
 * renders as a muted, non-interactive chip whose tooltip says why, so the
 * column stays aligned and nobody is sent to a 404.
 */
export function ViewOnSiteLink({
  href,
  visible = true,
  hiddenReason = "Not visible on the storefront yet",
  label,
}: {
  href: string;
  visible?: boolean;
  hiddenReason?: string;
  /** Names the item for screen readers, e.g. the product name. */
  label: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors";

  if (!visible) {
    return (
      <span
        title={hiddenReason}
        aria-label={`${label}: ${hiddenReason}`}
        className={cn(base, "cursor-not-allowed border-border text-text-muted opacity-60")}
      >
        <Eye className="size-3.5" />
        View
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ${label} on the storefront (opens in a new tab)`}
      className={cn(base, "border-border text-text-primary hover:border-primary hover:text-primary")}
    >
      <Eye className="size-3.5" />
      View
    </a>
  );
}
