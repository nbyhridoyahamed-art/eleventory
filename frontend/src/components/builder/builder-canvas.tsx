"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bookmark, Copy, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { HomepageBlockRenderer } from "@/components/homepage-blocks/homepage-block-renderer";
import { cn } from "@/lib/utils";
import type { HomepageBlockPreview } from "@/hooks/use-homepage-blocks";
import { HOMEPAGE_BLOCK_LABELS } from "@/types/homepage-block";
import type { Breakpoint } from "@/types/homepage-block";

const FRAME_WIDTH: Record<Breakpoint, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

interface BuilderCanvasProps {
  blocks: HomepageBlockPreview[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onReorder: (orderedIds: number[]) => void;
  onDuplicate: (id: number) => void;
  onDelete: (id: number) => void;
  onTogglePublish: (block: HomepageBlockPreview) => void;
  onSaveAsSection: (block: HomepageBlockPreview) => void;
  activeBreakpoint: Breakpoint;
  canEdit: boolean;
  canPublish: boolean;
}

/**
 * The CENTER canvas (spec section 58) — a real dnd-kit sortable list that
 * renders every block (draft included) through the exact same component
 * the live storefront uses, via the /homepage-blocks/preview endpoint. Not
 * a full click-anywhere WYSIWYG editor (text isn't edited inline on the
 * canvas itself) — selecting a block opens BuilderPanel for that.
 */
export function BuilderCanvas({
  blocks,
  isLoading,
  selectedId,
  onSelect,
  onReorder,
  onDuplicate,
  onDelete,
  onTogglePublish,
  onSaveAsSection,
  activeBreakpoint,
  canEdit,
  canPublish,
}: BuilderCanvasProps) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...blocks];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    onReorder(reordered.map((b) => b.id));
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          title="No blocks yet"
          description="Add a block from the panel on the left to start building your homepage."
        />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain bg-border/10 p-6">
      <div className="mx-auto space-y-4 transition-[max-width]" style={{ maxWidth: FRAME_WIDTH[activeBreakpoint] }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((block) => (
              <CanvasBlock
                key={block.id}
                block={block}
                selected={block.id === selectedId}
                onSelect={() => onSelect(block.id)}
                onDuplicate={() => onDuplicate(block.id)}
                onDelete={() => onDelete(block.id)}
                onTogglePublish={() => onTogglePublish(block)}
                onSaveAsSection={() => onSaveAsSection(block)}
                canEdit={canEdit}
                canPublish={canPublish}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

interface CanvasBlockProps {
  block: HomepageBlockPreview;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  onSaveAsSection: () => void;
  canEdit: boolean;
  canPublish: boolean;
}

function CanvasBlock({ block, selected, onSelect, onDuplicate, onDelete, onTogglePublish, onSaveAsSection, canEdit, canPublish }: CanvasBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative rounded-lg border-2 bg-background transition-colors",
        selected ? "border-primary" : "border-transparent hover:border-border",
        isDragging && "opacity-50",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-2 opacity-0 group-hover:opacity-100">
        <div className="pointer-events-auto flex items-center gap-1 rounded-md bg-surface px-1.5 py-1 shadow-sm">
          {canEdit ? (
            <button type="button" {...attributes} {...listeners} aria-label="Drag to reorder" className="cursor-grab p-1 text-text-muted active:cursor-grabbing">
              <GripVertical className="size-4" />
            </button>
          ) : null}
          <Badge variant={block.is_active ? "success" : "neutral"}>{block.is_active ? "Live" : "Draft"}</Badge>
          <span className="text-xs font-medium text-text-secondary">{HOMEPAGE_BLOCK_LABELS[block.type]}</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-md bg-surface px-1 py-1 shadow-sm">
          {canPublish ? (
            <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={block.is_active ? "Unpublish" : "Publish"} onClick={onTogglePublish}>
              {block.is_active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          ) : null}
          {canEdit ? (
            <>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Save as section" onClick={onSaveAsSection}>
                <Bookmark className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Duplicate block" onClick={onDuplicate}>
                <Copy className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Delete block" onClick={onDelete}>
                <Trash2 className="size-4 text-danger" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* A <div role="button"> rather than a real <button> — the rendered
          block below can itself contain links/buttons (e.g. a hero's CTA),
          and nesting interactive elements inside a <button> is invalid
          HTML; pointer-events-none keeps them inert either way. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        className="block w-full cursor-pointer p-4 text-left"
      >
        <div className="pointer-events-none">
          <HomepageBlockRenderer block={block} />
        </div>
      </div>
    </div>
  );
}
