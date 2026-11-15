import { Eye } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDomains } from "@/hooks/use-domains";

/**
 * Where this store lives: its primary custom domain, else its free subdomain.
 * Null when the platform has no per-store addresses (single-store installs), so links stay relative.
 */
function useStoreOrigin(): string | null {
  const { data } = useDomains();
  if (typeof window === "undefined" || !data) return null;

  const primary = data.domains.find((d) => d.is_primary && d.status === "active")?.domain ?? data.free_address;
  if (!primary) return null;

  const local = primary.endsWith(".localhost") || primary.endsWith(".test");
  if (local) {
    const port = primary.includes(":") ? "" : window.location.port ? `:${window.location.port}` : "";
    return `http://${primary}${port}`;
  }

  return `https://${primary}`;
}

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
  const origin = useStoreOrigin();
  const target = origin && href.startsWith("/") ? `${origin}${href}` : href;
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
      href={target}
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
