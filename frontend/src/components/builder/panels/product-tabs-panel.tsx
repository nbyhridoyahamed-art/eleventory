"use client";

import { Plus, Trash2 } from "lucide-react";

import type { ContentPanelProps } from "@/components/builder/panel-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAllBrands } from "@/hooks/use-brands";
import { useCategories } from "@/hooks/use-categories";
import type { ProductTab, ProductTabsSettings } from "@/types/homepage-block";

const MAX_TABS = 10;

const SOURCE_LABELS: Record<ProductTab["source"], string> = {
  newest: "Newest products",
  sale: "On sale",
  featured: "Featured products",
  category: "A category",
  brand: "A brand",
};

/**
 * One row of products with filter tabs: each tab is a label plus a source.
 * Category/brand tabs store the *slug* (the storefront filters the public
 * product list by slug), so the pickers below offer the store's real slugs.
 */
export function ProductTabsPanel({ value, onChange, storeId }: ContentPanelProps<ProductTabsSettings>) {
  const { data: categories } = useCategories(storeId);
  const { data: brandsData } = useAllBrands(storeId);
  const brands = brandsData?.data ?? [];

  function addTab() {
    onChange({ ...value, tabs: [...value.tabs, { label: "", source: "newest", category_slug: null, brand_slug: null }] });
  }

  function updateTab(index: number, patch: Partial<ProductTab>) {
    onChange({ ...value, tabs: value.tabs.map((tab, i) => (i === index ? { ...tab, ...patch } : tab)) });
  }

  function removeTab(index: number) {
    onChange({ ...value, tabs: value.tabs.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="product-tabs-heading">Heading</Label>
        <Input id="product-tabs-heading" value={value.heading} onChange={(event) => onChange({ ...value, heading: event.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="product-tabs-limit">Number to show</Label>
          <Input
            id="product-tabs-limit"
            type="number"
            min={1}
            max={24}
            value={value.limit}
            onChange={(event) => onChange({ ...value, limit: Number(event.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="product-tabs-view-all">&ldquo;View all&rdquo; link</Label>
          <Input
            id="product-tabs-view-all"
            value={value.view_all_url ?? ""}
            placeholder="/products"
            onChange={(event) => onChange({ ...value, view_all_url: event.target.value || null })}
          />
        </div>
      </div>

      <div className="space-y-3">
        {value.tabs.map((tab, index) => (
          <div key={index} className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-primary">Tab {index + 1}</p>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Remove tab"
                disabled={value.tabs.length <= 1}
                onClick={() => removeTab(index)}
              >
                <Trash2 className="text-danger" />
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`product-tabs-label-${index}`}>Label</Label>
              <Input
                id={`product-tabs-label-${index}`}
                value={tab.label}
                onChange={(event) => updateTab(index, { label: event.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`product-tabs-source-${index}`}>Shows</Label>
              <Select value={tab.source} onValueChange={(source) => updateTab(index, { source: source as ProductTab["source"] })}>
                <SelectTrigger id={`product-tabs-source-${index}`}>
                  <SelectValue>{SOURCE_LABELS[tab.source]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_LABELS) as ProductTab["source"][]).map((source) => (
                    <SelectItem key={source} value={source}>
                      {SOURCE_LABELS[source]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tab.source === "category" ? (
              <div className="space-y-1.5">
                <Label htmlFor={`product-tabs-category-${index}`}>Category</Label>
                <Select value={tab.category_slug ?? ""} onValueChange={(slug) => updateTab(index, { category_slug: slug })}>
                  <SelectTrigger id={`product-tabs-category-${index}`}>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map((category) => (
                      <SelectItem key={category.id} value={category.slug}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {tab.source === "brand" ? (
              <div className="space-y-1.5">
                <Label htmlFor={`product-tabs-brand-${index}`}>Brand</Label>
                <Input
                  id={`product-tabs-brand-${index}`}
                  list={`product-tabs-brands-${index}`}
                  value={tab.brand_slug ?? ""}
                  placeholder="Brand slug, e.g. anker"
                  onChange={(event) => updateTab(index, { brand_slug: event.target.value || null })}
                />
                <datalist id={`product-tabs-brands-${index}`}>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.slug}>
                      {brand.name}
                    </option>
                  ))}
                </datalist>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" disabled={value.tabs.length >= MAX_TABS} onClick={addTab}>
        <Plus />
        Add tab
      </Button>
    </div>
  );
}
