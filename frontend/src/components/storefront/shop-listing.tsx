"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { Check, LayoutGrid, List, Minus, PackageSearch, Plus, SlidersHorizontal } from "lucide-react";

import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopProductCard } from "@/components/storefront/shop-product-card";
import {
  useInfiniteStorefrontProducts,
  useStorefrontBrands,
  useStorefrontCategories,
  useStorefrontFacets,
} from "@/hooks/use-storefront-catalog";

type Sort = "price_asc" | "price_desc" | "newest";

/** Price filter buckets, in taka. `max: null` is open-ended. */
const PRICE_RANGES: { label: string; min: number; max: number | null }[] = [
  { label: "Under ৳500", min: 0, max: 500 },
  { label: "৳500 – ৳1,000", min: 500, max: 1000 },
  { label: "৳1,000 – ৳3,000", min: 1000, max: 3000 },
  { label: "৳3,000 – ৳10,000", min: 3000, max: 10000 },
  { label: "৳10,000 & above", min: 10000, max: null },
];

const BRANDS_COLLAPSED = 10;

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="border-b border-border px-4 py-4 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-[15px] font-semibold text-text-primary"
      >
        {title}
        {open ? <Minus className="size-4 text-text-muted" /> : <Plus className="size-4 text-text-muted" />}
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

function FilterRow({
  label,
  count,
  active,
  onClick,
  indent = false,
  box = true,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  indent?: boolean;
  box?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-2 py-1.5 text-left text-[13px] transition-colors hover:text-shop-ink",
        indent && "pl-6",
        active ? "font-medium text-shop-ink" : "text-text-secondary",
      )}
    >
      {box ? (
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-sm border",
            active ? "border-shop-accent bg-shop-accent text-shop-on-accent" : "border-border bg-surface",
          )}
        >
          {active ? <Check className="size-3" /> : null}
        </span>
      ) : null}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined ? <span className="text-xs text-text-muted">({count})</span> : null}
    </button>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px bg-border tablet:grid-cols-3 desktop:grid-cols-4 large:grid-cols-5">
      {Array.from({ length: 10 }).map((_, index) => (
        <Skeleton key={index} className="aspect-[3/4] w-full rounded-none" />
      ))}
    </div>
  );
}

interface ShopListingProps {
  /** Where filter changes are pushed — the shop (`/products`) or a category page. */
  basePath?: string;
  /** Pins the listing to one category (the category page); the category filter then navigates instead of filtering in place. */
  lockedCategory?: string;
  /** Pins the listing to one brand (the brand page); the brand filter then navigates instead of filtering in place. */
  lockedBrand?: string;
}

function ShopListingContent({ basePath = "/products", lockedCategory, lockedBrand }: ShopListingProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const category = lockedCategory ?? searchParams.get("category") ?? "";
  const brand = lockedBrand ?? searchParams.get("brand") ?? "";
  const sort = (searchParams.get("sort") ?? "") as Sort | "";
  const featured = searchParams.get("featured") === "1";
  const onSale = searchParams.get("sale") === "1";
  const min = searchParams.get("min");
  const max = searchParams.get("max");
  const minPrice = min !== null && min !== "" ? Number(min) : undefined;
  const maxPrice = max !== null && max !== "" ? Number(max) : undefined;

  const [view, setView] = useState<"grid" | "list">("grid");
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: categories } = useStorefrontCategories();
  const { data: brands } = useStorefrontBrands();
  const { data: facets } = useStorefrontFacets();
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteStorefrontProducts({
    search: search || undefined,
    category: category || undefined,
    brand: brand || undefined,
    featured: featured || undefined,
    onSale: onSale || undefined,
    minPrice,
    maxPrice,
    sort: sort || undefined,
  });

  const products = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
  const total = data?.pages[0]?.meta?.total ?? products.length;

  useEffect(() => {
    if (search && !isLoading) {
      trackEvent("search", { query: search, results_count: total });
    }
  }, [search, isLoading, total]);

  // Sidebar data -----------------------------------------------------------
  const categoryCounts = useMemo(() => facets?.categories ?? {}, [facets]);
  const topCategories = useMemo(
    () => (categories ?? []).filter((cat) => (categoryCounts[cat.slug] ?? 0) > 0),
    [categories, categoryCounts],
  );
  const activeTop = useMemo(
    () =>
      (categories ?? []).find((cat) => cat.slug === category || cat.children.some((child) => child.slug === category)),
    [categories, category],
  );
  const activeCategory = useMemo(() => {
    if (!category) return null;
    for (const cat of categories ?? []) {
      if (cat.slug === category) return cat;
      const child = cat.children.find((c) => c.slug === category);
      if (child) return child;
    }
    return null;
  }, [categories, category]);
  const activeCategoryName = activeCategory?.name ?? null;
  // A sub-category's breadcrumb goes through its parent.
  const parentCategory = activeTop && activeTop.slug !== category ? activeTop : null;

  // The category page is pinned to a slug: once the tree has loaded, an unknown one is a 404.
  if (lockedCategory && categories && !activeCategory) {
    notFound();
  }

  useEffect(() => {
    if (lockedCategory && activeCategory?.id) {
      trackEvent("category_view", { category_id: activeCategory.id });
    }
  }, [lockedCategory, activeCategory?.id]);

  const brandOptions = useMemo(() => {
    const counts = facets?.brands ?? {};
    return (brands ?? [])
      .filter((b) => (counts[b.slug] ?? 0) > 0)
      .map((b) => ({ ...b, count: counts[b.slug] }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [brands, facets]);
  // Keep the active brand visible even when it falls outside the collapsed top list.
  const visibleBrands = useMemo(() => {
    if (showAllBrands) return brandOptions;
    const top = brandOptions.slice(0, BRANDS_COLLAPSED);
    const active = brandOptions.find((b) => b.slug === brand);
    return active && !top.includes(active) ? [active, ...top] : top;
  }, [showAllBrands, brandOptions, brand]);
  const activeBrand = useMemo(() => (brands ?? []).find((b) => b.slug === brand) ?? null, [brands, brand]);

  // The brand page is pinned to a slug: once the brand list has loaded, an unknown one is a 404.
  if (lockedBrand && brands && !activeBrand) {
    notFound();
  }

  const hasFilters = Boolean(search || (!lockedCategory && category) || (!lockedBrand && brand) || featured || onSale || sort || min || max);
  const highlight: "all" | "new" | "sale" | "hot" = onSale ? "sale" : featured ? "hot" : sort === "newest" ? "new" : "all";

  function setParams(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  // On the shop the brand is a filter; on a brand page it is the route.
  function selectBrand(slug: string | null) {
    if (lockedBrand) {
      router.push(slug ? `/brand/${slug}` : "/products");
    } else {
      setParams({ brand: slug });
    }
  }

  // On the shop the category is a filter; on a category page it is the route.
  function selectCategory(slug: string | null) {
    if (lockedCategory) {
      router.push(slug ? `/category/${slug}` : "/products");
    } else {
      setParams({ category: slug });
    }
  }

  function setHighlight(next: "all" | "new" | "sale" | "hot") {
    setParams({
      featured: next === "hot" ? "1" : null,
      sale: next === "sale" ? "1" : null,
      sort: next === "new" ? "newest" : sort === "newest" ? null : sort || null,
    });
  }

  const pageTitle = search ? `Search results for “${search}”` : (lockedBrand ? activeBrand?.name : activeCategoryName) ?? "Shop";

  const sidebar = (
    <aside className="border border-border bg-surface" aria-label="Product filters">
      <FilterSection title="Shop By Categories">
        <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
          <FilterRow label="All categories" active={!category} onClick={() => selectCategory(null)} />
          {topCategories.map((cat) => {
            const isOpen = activeTop?.slug === cat.slug;
            return (
              <div key={cat.id}>
                <FilterRow
                  label={cat.name}
                  count={categoryCounts[cat.slug]}
                  active={category === cat.slug}
                  onClick={() => selectCategory(category === cat.slug ? null : cat.slug)}
                />
                {isOpen
                  ? cat.children
                      .filter((child) => (categoryCounts[child.slug] ?? 0) > 0)
                      .map((child) => (
                        <FilterRow
                          key={child.id}
                          indent
                          label={child.name}
                          count={categoryCounts[child.slug]}
                          active={category === child.slug}
                          onClick={() => selectCategory(category === child.slug ? null : child.slug)}
                        />
                      ))
                  : null}
              </div>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection title="Highlight">
        <FilterRow box={false} label="All Products" active={highlight === "all"} onClick={() => setHighlight("all")} />
        <FilterRow box={false} label="New Arrivals" active={highlight === "new"} onClick={() => setHighlight("new")} />
        <FilterRow box={false} label="Sale" active={highlight === "sale"} onClick={() => setHighlight("sale")} />
        <FilterRow box={false} label="Hot Items" active={highlight === "hot"} onClick={() => setHighlight("hot")} />
      </FilterSection>

      <FilterSection title="Brands">
        <div className={cn("space-y-0.5", showAllBrands && "max-h-72 overflow-y-auto pr-1")}>
          {visibleBrands.map((b) => (
            <FilterRow
              key={b.id}
              label={b.name}
              count={b.count}
              active={brand === b.slug}
              onClick={() => selectBrand(brand === b.slug ? null : b.slug)}
            />
          ))}
        </div>
        {brandOptions.length > BRANDS_COLLAPSED ? (
          <button
            type="button"
            onClick={() => setShowAllBrands((value) => !value)}
            className="mt-2 text-xs font-medium text-shop-ink hover:underline"
          >
            {showAllBrands ? "Show fewer" : `Show all ${brandOptions.length} brands`}
          </button>
        ) : null}
      </FilterSection>

      <FilterSection title="Price Filter">
        <FilterRow
          box={false}
          label="All"
          active={minPrice === undefined && maxPrice === undefined}
          onClick={() => setParams({ min: null, max: null })}
        />
        {PRICE_RANGES.map((range) => {
          const active = minPrice === range.min && (range.max === null ? maxPrice === undefined : maxPrice === range.max);
          return (
            <FilterRow
              key={range.label}
              box={false}
              label={range.label}
              active={active}
              onClick={() => setParams({ min: String(range.min), max: range.max === null ? null : String(range.max) })}
            />
          );
        })}
      </FilterSection>
    </aside>
  );

  return (
    <div>
      {/* Breadcrumb banner */}
      <div className="bg-shop-tint">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-1 px-4 py-8 text-center">
          <nav aria-label="Breadcrumb" className="text-xs text-text-secondary">
            <Link href="/" className="hover:text-shop-ink">
              Home
            </Link>
            <span className="mx-1">/</span>
            {lockedBrand ? (
              <>
                <Link href="/brands" className="hover:text-shop-ink">
                  Brands
                </Link>
                <span className="mx-1">/</span>
                <span className="text-text-primary">{activeBrand?.name ?? lockedBrand}</span>
              </>
            ) : category || search ? (
              <>
                <Link href="/products" className="hover:text-shop-ink">
                  Shop
                </Link>
                <span className="mx-1">/</span>
                {parentCategory ? (
                  <>
                    <Link href={`/category/${parentCategory.slug}`} className="hover:text-shop-ink">
                      {parentCategory.name}
                    </Link>
                    <span className="mx-1">/</span>
                  </>
                ) : null}
                <span className="text-text-primary">{activeCategoryName ?? "Search"}</span>
              </>
            ) : (
              <span className="text-text-primary">Shop</span>
            )}
          </nav>
          <h1 className="text-page-title font-semibold text-text-primary">{pageTitle}</h1>
          {lockedCategory && activeCategory?.description ? (
            <p className="max-w-2xl text-sm text-text-secondary">{activeCategory.description}</p>
          ) : null}
          {lockedBrand && activeBrand?.description ? (
            <p className="max-w-2xl text-sm text-text-secondary">{activeBrand.description}</p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-8">
        <div className="grid gap-6 desktop:grid-cols-[250px_1fr]">
          {/* Sidebar — always visible on desktop, toggled on smaller screens */}
          <div className={cn(filtersOpen ? "block" : "hidden", "desktop:block")}>{sidebar}</div>

          <div className="min-w-0 space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((value) => !value)}
                  aria-expanded={filtersOpen}
                  className="flex items-center gap-2 border border-border px-3 py-1.5 text-sm text-text-primary desktop:hidden"
                >
                  <SlidersHorizontal className="size-4" />
                  Filters
                </button>
                <p className="text-[13px] text-text-secondary">
                  {isLoading
                    ? "Loading…"
                    : total === 0
                      ? "No results"
                      : `Showing 1–${products.length} of ${total.toLocaleString("en-US")} results`}
                </p>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={() => router.push(basePath)}
                    className="text-[13px] font-medium text-shop-ink hover:underline"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={sort || "default"}
                  onValueChange={(value) => setParams({ sort: value === "default" ? null : value })}
                >
                  <SelectTrigger className="h-9 w-48 rounded-none text-[13px]" aria-label="Sort products">
                    <SelectValue placeholder="Default sorting" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default sorting</SelectItem>
                    <SelectItem value="newest">Sort by latest</SelectItem>
                    <SelectItem value="price_asc">Price: low to high</SelectItem>
                    <SelectItem value="price_desc">Price: high to low</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1" role="group" aria-label="Product view">
                  {(
                    [
                      ["grid", LayoutGrid, "Grid view"],
                      ["list", List, "List view"],
                    ] as const
                  ).map(([mode, Icon, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setView(mode)}
                      aria-label={label}
                      aria-pressed={view === mode}
                      className={cn(
                        "flex size-9 items-center justify-center transition-colors",
                        view === mode
                          ? "bg-shop-accent text-shop-on-accent"
                          : "bg-border/40 text-text-secondary hover:bg-border",
                      )}
                    >
                      <Icon className="size-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            {isLoading ? (
              <ProductGridSkeleton />
            ) : products.length === 0 ? (
              <EmptyState
                icon={<PackageSearch />}
                title="No products found"
                description="Try a different search or clear some filters."
              />
            ) : (
              <>
                <div
                  className={cn(
                    "grid border-l border-t border-border",
                    view === "grid"
                      ? "grid-cols-2 tablet:grid-cols-3 desktop:grid-cols-4 large:grid-cols-5"
                      : "grid-cols-1",
                  )}
                >
                  {products.map((product) => (
                    <div key={product.id} className="border-b border-r border-border">
                      <ShopProductCard product={product} layout={view} />
                    </div>
                  ))}
                </div>

                {hasNextPage ? (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="bg-shop-accent px-8 py-2.5 text-xs font-semibold uppercase tracking-wide text-shop-on-accent transition-colors hover:bg-shop-accent-hover disabled:opacity-60"
                    >
                      {isFetchingNextPage ? "Loading…" : "Load more"}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The shop listing — filter sidebar, toolbar and product grid — shared by the shop and category pages. */
export function ShopListing(props: ShopListingProps) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1400px] px-4 py-8">
          <ProductGridSkeleton />
        </div>
      }
    >
      <ShopListingContent {...props} />
    </Suspense>
  );
}
