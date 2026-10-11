"use client";

import { useState } from "react";
import { History, Loader2, Redo2, Undo2 } from "lucide-react";

import { AdvancedPanel } from "@/components/builder/panels/advanced-panel";
import { AnimationPanel } from "@/components/builder/panels/animation-panel";
import { DesignPanel } from "@/components/builder/panels/design-panel";
import { LayoutPanel } from "@/components/builder/panels/layout-panel";
import { SeoPanel } from "@/components/builder/panels/seo-panel";
import { CONTENT_PANELS } from "@/components/builder/content-panel-registry";
import { RevisionHistorySheet } from "@/components/builder/revision-history-sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditableHomepageBlock, type EditableBlockSource } from "@/hooks/use-editable-homepage-block";
import { HOMEPAGE_BLOCK_LABELS } from "@/types/homepage-block";
import type { Breakpoint, HomepageBlockType } from "@/types/homepage-block";

const TABS = ["Content", "Design", "Layout", "Animation", "Advanced", "SEO"] as const;
type Tab = (typeof TABS)[number];

interface BuilderPanelProps {
  block: EditableBlockSource & { type: HomepageBlockType };
  storeId: number;
  activeBreakpoint: Breakpoint;
  onBreakpointChange: (breakpoint: Breakpoint) => void;
  canEdit: boolean;
}

/**
 * The right-side settings panel (spec section 58: Content/Design/Spacing/
 * Responsive/Animation/Advanced/SEO). Spacing+Responsive+per-breakpoint
 * visibility are combined into one "Layout" tab — see LayoutPanel's own
 * comment for why. Owns this block's local autosave + undo/redo session.
 */
export function BuilderPanel({ block, storeId, activeBreakpoint, onBreakpointChange, canEdit }: BuilderPanelProps) {
  const [tab, setTab] = useState<Tab>("Content");
  const [historyOpen, setHistoryOpen] = useState(false);
  const editable = useEditableHomepageBlock(block);
  const ContentPanel = CONTENT_PANELS[block.type];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{HOMEPAGE_BLOCK_LABELS[block.type]}</p>
          <SaveStatusLabel status={editable.status} />
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Revision history" onClick={() => setHistoryOpen(true)}>
            <History />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Undo" disabled={!editable.canUndo || !canEdit} onClick={editable.undo}>
            <Undo2 />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Redo" disabled={!editable.canRedo || !canEdit} onClick={editable.redo}>
            <Redo2 />
          </Button>
        </div>
      </div>

      <RevisionHistorySheet
        blockId={block.id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        canEdit={canEdit}
        onRestored={editable.syncFrom}
      />

      {/* Six tabs never fit one row in the 320px panel (they measured ~490px
          and forced a horizontal scrollbar), so they wrap into two rows. */}
      <div className="grid shrink-0 grid-cols-3 gap-1 border-b border-border px-2 py-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-primary/8 text-primary" : "text-text-secondary hover:bg-border/30",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <fieldset disabled={!canEdit} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {tab === "Content" ? (
          ContentPanel ? (
            <ContentPanel value={editable.draft.settings} onChange={editable.setSettings} storeId={storeId} />
          ) : (
            <p className="text-sm text-text-muted">This block type&apos;s content editor isn&apos;t wired up yet.</p>
          )
        ) : null}
        {tab === "Design" ? <DesignPanel value={editable.draft.styles} onChange={editable.setStyles} /> : null}
        {tab === "Layout" ? (
          <LayoutPanel
            responsive={editable.draft.responsive}
            visibility={editable.draft.visibility}
            onResponsiveChange={editable.setResponsive}
            onVisibilityChange={editable.setVisibility}
            activeBreakpoint={activeBreakpoint}
            onBreakpointChange={onBreakpointChange}
          />
        ) : null}
        {tab === "Animation" ? <AnimationPanel value={editable.draft.animation} onChange={editable.setAnimation} /> : null}
        {tab === "Advanced" ? <AdvancedPanel value={editable.draft.styles} onChange={editable.setStyles} /> : null}
        {tab === "SEO" ? <SeoPanel storeId={storeId} /> : null}
      </fieldset>
    </div>
  );
}

function SaveStatusLabel({ status }: { status: "saved" | "saving" | "unsaved" }) {
  if (status === "saving") {
    return (
      <p className="flex items-center gap-1 text-xs text-text-muted">
        <Loader2 className="size-3 animate-spin" /> Saving...
      </p>
    );
  }
  if (status === "unsaved") return <p className="text-xs text-text-muted">Unsaved changes</p>;
  return <p className="text-xs text-success">Saved</p>;
}
