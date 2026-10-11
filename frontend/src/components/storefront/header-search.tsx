"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Tag } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useSearchSuggestions } from "@/hooks/use-storefront-catalog";

interface Category {
  id: number;
  name: string;
  slug: string;
}

type SuggestionItem = {
  key: string;
  label: string;
  href: string;
  group: "Keywords" | "Categories" | "Brands" | "Products";
  image?: string | null;
  price?: { amount: number; sale: number | null; currency: string };
};

const MIN_CHARS = 2;
const DEBOUNCE_MS = 200;

/** Bolds the part of `text` the shopper has typed. */
function Highlight({ text, term }: { text: string; term: string }) {
  const index = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <strong className="font-semibold text-text-primary">{text.slice(index, index + term.length)}</strong>
      {text.slice(index + term.length)}
    </>
  );
}

/**
 * The header search box with live suggestions: keywords, categories, brands
 * and products matching what is being typed. Arrow keys move through the
 * list, Enter opens the highlighted item (or runs the search when nothing is
 * highlighted) and Escape closes it.
 */
export function HeaderSearch({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const { data } = useSearchSuggestions(debounced);
  const ready = debounced.length >= MIN_CHARS && query.trim() === debounced;

  const items = useMemo<SuggestionItem[]>(() => {
    if (!data || debounced.length < MIN_CHARS) return [];

    return [
      ...data.keywords.map((keyword) => ({
        key: `k:${keyword}`,
        label: keyword,
        href: `/products?search=${encodeURIComponent(keyword)}`,
        group: "Keywords" as const,
      })),
      ...data.categories.map((c) => ({
        key: `c:${c.slug}`,
        label: c.name,
        href: `/category/${c.slug}`,
        group: "Categories" as const,
      })),
      ...data.brands.map((b) => ({
        key: `b:${b.slug}`,
        label: b.name,
        href: `/brand/${b.slug}`,
        group: "Brands" as const,
      })),
      ...data.products.map((p) => ({
        key: `p:${p.slug}`,
        label: p.name,
        href: `/products/${p.slug}`,
        group: "Products" as const,
        image: p.image_url,
        price: { amount: p.price, sale: p.sale_price, currency: p.currency_code },
      })),
    ];
  }, [data, debounced]);

  // Close when clicking anywhere outside this search box.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setActive(-1);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(value.trim()), DEBOUNCE_MS);
  }

  function runSearch() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("search", query.trim());
    if (category) params.set("category", category);
    const qs = params.toString();
    setOpen(false);
    router.push(qs ? `/products?${qs}` : "/products");
  }

  function go(item: SuggestionItem) {
    setOpen(false);
    router.push(item.href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || items.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? items.length - 1 : index - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      go(items[active]);
    }
  }

  const showPanel = open && ready && items.length > 0;
  const groups = (["Keywords", "Categories", "Brands", "Products"] as const)
    .map((group) => ({ group, entries: items.map((item, index) => ({ item, index })).filter((e) => e.item.group === group) }))
    .filter((g) => g.entries.length > 0);

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
        role="search"
        className="flex h-11 min-w-0 items-stretch overflow-hidden border-2 border-shop-accent bg-surface"
      >
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Search in category"
          className="hidden w-44 shrink-0 border-r border-border bg-surface px-3 text-sm text-text-primary outline-none tablet:block"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder="Search products..."
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search products"
          className="min-w-0 flex-1 bg-surface px-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex shrink-0 items-center gap-2 bg-shop-accent px-4 text-xs font-semibold uppercase tracking-wide text-shop-on-accent hover:bg-shop-accent-hover"
        >
          <Search className="size-4 tablet:hidden" aria-hidden="true" />
          <span className="hidden tablet:inline">Search</span>
        </button>
      </form>

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto border border-border bg-surface text-text-secondary shadow-lg"
        >
          {groups.map(({ group, entries }) => (
            <div key={group}>
              <p className="border-b border-border bg-shop-tint px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                {group}
              </p>
              <ul>
                {entries.map(({ item, index }) => (
                  <li key={item.key} role="presentation">
                    <Link
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={index === active}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      onMouseEnter={() => setActive(index)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2 text-sm",
                        index === active ? "bg-shop-tint" : "hover:bg-shop-tint",
                      )}
                    >
                      {item.group === "Products" ? (
                        <>
                          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden border border-border bg-white p-0.5">
                            {item.image ? (
                              // eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset
                              <img src={item.image} alt="" className="max-h-full max-w-full object-contain" />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 block leading-snug">
                              <Highlight text={item.label} term={debounced} />
                            </span>
                          </span>
                          {item.price ? (
                            <span className="shrink-0 text-right text-sm font-semibold text-shop-ink">
                              {formatMoney(item.price.sale ?? item.price.amount, item.price.currency)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {item.group === "Keywords" ? (
                            <Search className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                          ) : (
                            <Tag className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                          )}
                          <span className="min-w-0 flex-1 truncate">
                            <Highlight text={item.label} term={debounced} />
                          </span>
                        </>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <button
            type="button"
            onClick={runSearch}
            className="flex w-full items-center gap-2 border-t border-border bg-shop-tint px-4 py-2.5 text-left text-sm font-medium text-shop-ink hover:underline"
          >
            <Search className="size-4" aria-hidden="true" />
            See all results for &ldquo;{debounced}&rdquo;
          </button>
        </div>
      ) : null}
    </div>
  );
}
