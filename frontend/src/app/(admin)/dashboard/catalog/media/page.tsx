"use client";

import { useRef, useState } from "react";
import { ImagePlus, Pencil, Trash2, Upload } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useDeleteMedia, useMedia, useUpdateMedia, useUploadMedia } from "@/hooks/use-media";
import { PermissionDenied } from "@/components/permission-denied";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Media } from "@/types/media";

export default function MediaLibraryPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;

  const inputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [mediaToEdit, setMediaToEdit] = useState<Media | null>(null);
  const [altText, setAltText] = useState("");
  const [mediaToDelete, setMediaToDelete] = useState<Media | null>(null);

  const { data, isLoading } = useMedia(storeId, { page, search: search || undefined });
  const upload = useUploadMedia();
  const update = useUpdateMedia();
  const remove = useDeleteMedia();

  if (currentUser && !can(currentUser, "media.view")) {
    return <PermissionDenied />;
  }

  const canUpload = can(currentUser, "media.create");
  const canUpdate = can(currentUser, "media.update");
  const canDelete = can(currentUser, "media.delete");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && storeId) upload.mutate({ file, storeId });
    event.target.value = "";
  };

  const items = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by filename..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        {canUpload ? (
          <Button onClick={() => inputRef.current?.click()} loading={upload.isPending}>
            <Upload />
            Upload
          </Button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-md" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ImagePlus />}
          title="No media yet"
          description="Files you upload here become reusable across categories, brands, and product galleries."
          action={
            canUpload ? (
              <Button size="sm" onClick={() => inputRef.current?.click()}>
                Upload a file
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {items.map((item) => (
            <div key={item.id} className="group relative overflow-hidden rounded-md border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset */}
              <img src={item.url} alt={item.alt_text ?? ""} className="aspect-square w-full object-cover" />

              <div className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {item.filename}
              </div>

              <div className="absolute inset-x-0 top-0 flex justify-end gap-1 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                {canUpdate ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 bg-black/50 text-white hover:bg-black/70 hover:text-white"
                    aria-label={`Edit ${item.filename}`}
                    onClick={() => {
                      setMediaToEdit(item);
                      setAltText(item.alt_text ?? "");
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 bg-black/50 text-white hover:bg-black/70 hover:text-white"
                    aria-label={`Delete ${item.filename}`}
                    onClick={() => setMediaToDelete(item)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.meta && data.meta.last_page > 1 ? (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <p>
            Page {data.meta.current_page} of {data.meta.last_page} &middot; {data.meta.total} total
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.meta.current_page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.meta.current_page >= data.meta.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(mediaToEdit)} onOpenChange={(open) => !open && setMediaToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit alt text</DialogTitle>
            <DialogDescription>Describes the image for screen readers and search engines.</DialogDescription>
          </DialogHeader>
          <Input
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            placeholder="e.g. Red cotton t-shirt, front view"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMediaToEdit(null)}>
              Cancel
            </Button>
            <Button
              loading={update.isPending}
              onClick={() => {
                if (mediaToEdit) {
                  update.mutate(
                    { id: mediaToEdit.id, altText },
                    { onSuccess: () => setMediaToEdit(null) },
                  );
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(mediaToDelete)} onOpenChange={(open) => !open && setMediaToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file</DialogTitle>
            <DialogDescription>
              This permanently removes the file. Anything still using it (a category, brand, or product image)
              will show a broken image.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMediaToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={remove.isPending}
              onClick={() => {
                if (mediaToDelete) {
                  remove.mutate(mediaToDelete.id, { onSuccess: () => setMediaToDelete(null) });
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
