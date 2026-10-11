"use client";

import { useState } from "react";
import { Bookmark, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDeleteSavedSection, useInsertSavedSection, useSavedSections } from "@/hooks/use-saved-sections";
import { HOMEPAGE_BLOCK_CATEGORIES, HOMEPAGE_BLOCK_LABELS } from "@/types/homepage-block";
import type { HomepageBlockPreview } from "@/hooks/use-homepage-blocks";
import type { HomepageBlockType } from "@/types/homepage-block";

const TABS = ["Blocks", "Layers", "Saved"] as const;
type SidebarTab = (typeof TABS)[number];

interface BuilderSidebarProps {
  blocks: HomepageBlockPreview[];
  selectedId: number | null;
  onSelectBlock: (id: number) => void;
  onAddBlock: (type: HomepageBlockType) => void;
  storeId: number;
  canEdit: boolean;
}

/** The LEFT panel (spec section 58): Blocks / Layers / Saved Blocks. */
export function BuilderSidebar({ blocks, selectedId, onSelectBlock, onAddBlock, storeId, canEdit }: BuilderSidebarProps) {
  const [tab, setTab] = useState<SidebarTab>("Blocks");

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border">
      <div className="flex shrink-0 gap-1 border-b border-border p-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-primary/8 text-primary" : "text-text-secondary hover:bg-border/30",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {tab === "Blocks" ? <BlockPicker onAddBlock={onAddBlock} disabled={!canEdit} /> : null}
        {tab === "Layers" ? <LayersList blocks={blocks} selectedId={selectedId} onSelect={onSelectBlock} /> : null}
        {tab === "Saved" ? <SavedSectionsList storeId={storeId} disabled={!canEdit} /> : null}
      </div>
    </div>
  );
}

function BlockPicker({ onAddBlock, disabled }: { onAddBlock: (type: HomepageBlockType) => void; disabled: boolean }) {
  return (
    <div className="space-y-4">
      {HOMEPAGE_BLOCK_CATEGORIES.map((category) => (
        <div key={category.label} className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{category.label}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {category.types.map((type) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                className="h-auto justify-start whitespace-normal py-2 text-left"
                onClick={() => onAddBlock(type)}
              >
                {HOMEPAGE_BLOCK_LABELS[type]}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LayersList({ blocks, selectedId, onSelect }: { blocks: HomepageBlockPreview[]; selectedId: number | null; onSelect: (id: number) => void }) {
  if (blocks.length === 0) {
    return <p className="p-2 text-sm text-text-muted">No blocks yet.</p>;
  }

  return (
    <ul className="space-y-1">
      {blocks.map((block, index) => (
        <li key={block.id}>
          <button
            type="button"
            onClick={() => onSelect(block.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm",
              block.id === selectedId ? "bg-primary/8 text-primary" : "hover:bg-border/30",
            )}
          >
            <span className="flex items-center gap-2">
              <span className="text-xs text-text-muted">{index + 1}</span>
              {HOMEPAGE_BLOCK_LABELS[block.type]}
            </span>
            <Badge variant={block.is_active ? "success" : "neutral"}>{block.is_active ? "Live" : "Draft"}</Badge>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SavedSectionsList({ storeId, disabled }: { storeId: number; disabled: boolean }) {
  const { data: sections, isLoading } = useSavedSections(storeId);
  const insertSection = useInsertSavedSection();
  const deleteSection = useDeleteSavedSection();

  if (isLoading) return <p className="p-2 text-sm text-text-muted">Loading...</p>;

  if (!sections || sections.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 text-center">
        <Bookmark className="size-6 text-text-muted" />
        <p className="text-sm text-text-muted">
          No saved sections yet. Select a block on the canvas and choose &quot;Save as section&quot; to build a reusable library.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {sections.map((section) => (
        <li key={section.id} className="rounded-md border border-border p-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-text-primary">{section.name}</p>
              <p className="text-xs text-text-muted">{HOMEPAGE_BLOCK_LABELS[section.type]}</p>
            </div>
          </div>
          <div className="mt-2 flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              loading={insertSection.isPending}
              onClick={() => insertSection.mutate({ id: section.id, storeId })}
            >
              <Plus className="size-3.5" /> Add to page
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => deleteSection.mutate(section.id)}
            >
              Remove
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
