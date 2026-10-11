import { cn } from "@/lib/utils";
import type { PaginationMeta } from "@/types/api";

const BUTTON =
  "border border-border bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-primary transition-colors hover:border-shop-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border";

export function StorefrontPagination({
  meta,
  onPageChange,
  itemLabel = "products",
}: {
  meta: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  if (!meta || meta.last_page <= 1) {
    return null;
  }

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <p className="text-sm text-text-secondary">
        Page {meta.current_page} of {meta.last_page} &middot; {meta.total} {itemLabel}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={cn(BUTTON)}
          disabled={meta.current_page <= 1}
          onClick={() => onPageChange(meta.current_page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className={cn(BUTTON)}
          disabled={meta.current_page >= meta.last_page}
          onClick={() => onPageChange(meta.current_page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
