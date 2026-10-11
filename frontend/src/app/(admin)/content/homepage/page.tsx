"use client";

import { useState } from "react";
import { Monitor, Rocket, Smartphone, Tablet } from "lucide-react";

import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { HOMEPAGE_BLOCK_DEFAULTS } from "@/lib/homepage-block-defaults";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useCreateHomepageBlock,
  useDeleteHomepageBlock,
  useDuplicateHomepageBlock,
  useHomepageBlockPreview,
  usePublishHomepageBlock,
  useReorderHomepageBlocks,
  useSaveHomepageBlockAsSection,
  useUnpublishHomepageBlock,
  type HomepageBlockPreview,
} from "@/hooks/use-homepage-blocks";
import { PermissionDenied } from "@/components/permission-denied";
import { BuilderCanvas } from "@/components/builder/builder-canvas";
import { BuilderPanel } from "@/components/builder/builder-panel";
import { BuilderSidebar } from "@/components/builder/builder-sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { Breakpoint, HomepageBlockType } from "@/types/homepage-block";

const DEVICE_ICONS: Record<Breakpoint, typeof Monitor> = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

/**
 * Fills whatever the viewport has left below the app top bar, page padding,
 * "Content" heading and tab nav (~14.3rem in total), so the page itself never
 * scrolls behind the builder's three independently-scrolling panes. The min
 * keeps the panes usable on very short windows, where the page scroll takes over.
 */
const BUILDER_HEIGHT = "h-[calc(100vh-15rem)] min-h-[24rem]";

export default function HomepageBuilderPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeBreakpoint, setActiveBreakpoint] = useState<Breakpoint>("desktop");
  const [blockToDelete, setBlockToDelete] = useState<HomepageBlockPreview | null>(null);
  const [blockToSaveAsSection, setBlockToSaveAsSection] = useState<HomepageBlockPreview | null>(null);
  const [sectionName, setSectionName] = useState("");

  const { data: blocks, isLoading } = useHomepageBlockPreview(storeId);
  const createBlock = useCreateHomepageBlock();
  const deleteBlock = useDeleteHomepageBlock();
  const duplicateBlock = useDuplicateHomepageBlock();
  const reorderBlocks = useReorderHomepageBlocks();
  const publishBlock = usePublishHomepageBlock();
  const unpublishBlock = useUnpublishHomepageBlock();
  const saveAsSection = useSaveHomepageBlockAsSection();

  if (currentUser && !can(currentUser, "builder.view")) {
    return <PermissionDenied />;
  }

  const canEdit = can(currentUser, "builder.edit");
  const canPublish = can(currentUser, "builder.publish");

  if (isLoading || !storeId) {
    return <Skeleton className={cn(BUILDER_HEIGHT, "w-full")} />;
  }

  const list = blocks ?? [];
  const selected = list.find((block) => block.id === selectedId) ?? null;
  const draftCount = list.filter((block) => !block.is_active).length;

  function handleAddBlock(type: HomepageBlockType) {
    if (!storeId) return;
    createBlock.mutate(
      { store_id: storeId, type, settings: HOMEPAGE_BLOCK_DEFAULTS[type] as unknown as Record<string, unknown> },
      { onSuccess: (created) => setSelectedId(created.id) },
    );
  }

  function handlePublishAllDrafts() {
    if (!storeId) return;
    list.filter((block) => !block.is_active).forEach((block) => publishBlock.mutate(block.id));
  }

  return (
    <div className={cn(BUILDER_HEIGHT, "flex flex-col overflow-hidden rounded-lg border border-border")}>
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2.5">
        <p className="text-sm font-semibold text-text-primary">Homepage</p>

        <div className="flex items-center gap-1 rounded-md border border-border p-1">
          {(Object.keys(DEVICE_ICONS) as Breakpoint[]).map((bp) => {
            const Icon = DEVICE_ICONS[bp];
            return (
              <Button
                key={bp}
                type="button"
                variant={activeBreakpoint === bp ? "secondary" : "ghost"}
                size="icon"
                className="size-8"
                aria-label={`Preview at ${bp} width`}
                onClick={() => setActiveBreakpoint(bp)}
              >
                <Icon className="size-4" />
              </Button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/" target="_blank" rel="noopener noreferrer">
              Preview live site
            </a>
          </Button>
          {canPublish ? (
            <Button size="sm" disabled={draftCount === 0} loading={publishBlock.isPending} onClick={handlePublishAllDrafts}>
              <Rocket className="size-4" />
              Publish all drafts{draftCount > 0 ? ` (${draftCount})` : ""}
            </Button>
          ) : null}
        </div>
      </div>

      {/* The explicit minmax(0,1fr) row is what makes each column's own
          overflow-y-auto work — with the default implicit `auto` row the grid
          grows to its tallest column (the canvas) and this wrapper's
          overflow-hidden just clips the sidebar, canvas and settings panel. */}
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_320px] grid-rows-[minmax(0,1fr)]">
        <BuilderSidebar
          blocks={list}
          selectedId={selectedId}
          onSelectBlock={setSelectedId}
          onAddBlock={handleAddBlock}
          storeId={storeId}
          canEdit={canEdit}
        />

        <BuilderCanvas
          blocks={list}
          isLoading={false}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReorder={(order) => reorderBlocks.mutate(order)}
          onDuplicate={(id) => duplicateBlock.mutate(id, { onSuccess: (created) => setSelectedId(created.id) })}
          onDelete={(id) => {
            const block = list.find((b) => b.id === id);
            if (block) setBlockToDelete(block);
          }}
          onTogglePublish={(block) => (block.is_active ? unpublishBlock.mutate(block.id) : publishBlock.mutate(block.id))}
          onSaveAsSection={setBlockToSaveAsSection}
          activeBreakpoint={activeBreakpoint}
          canEdit={canEdit}
          canPublish={canPublish}
        />

        <div className="min-h-0 overflow-hidden border-l border-border">
          {selected ? (
            <BuilderPanel
              key={selected.id}
              block={selected}
              storeId={storeId}
              activeBreakpoint={activeBreakpoint}
              onBreakpointChange={setActiveBreakpoint}
              canEdit={canEdit}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-text-muted">
              Select a block on the canvas to edit it, or add one from the panel on the left.
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(blockToDelete)} onOpenChange={(open) => !open && setBlockToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete block</DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteBlock.isPending}
              onClick={() => {
                if (!blockToDelete) return;
                deleteBlock.mutate(blockToDelete.id, {
                  onSuccess: () => {
                    if (selectedId === blockToDelete.id) setSelectedId(null);
                    setBlockToDelete(null);
                  },
                });
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(blockToSaveAsSection)}
        onOpenChange={(open) => {
          if (!open) {
            setBlockToSaveAsSection(null);
            setSectionName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as section</DialogTitle>
            <DialogDescription>Reuse this block elsewhere on the homepage, or on future pages, from the Saved tab.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="section-name">Name</Label>
            <Input
              id="section-name"
              value={sectionName}
              onChange={(event) => setSectionName(event.target.value)}
              placeholder="e.g. Summer promo banner"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBlockToSaveAsSection(null);
                setSectionName("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!sectionName.trim()}
              loading={saveAsSection.isPending}
              onClick={() => {
                if (!blockToSaveAsSection) return;
                saveAsSection.mutate(
                  { id: blockToSaveAsSection.id, name: sectionName.trim() },
                  {
                    onSuccess: () => {
                      setBlockToSaveAsSection(null);
                      setSectionName("");
                    },
                  },
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
