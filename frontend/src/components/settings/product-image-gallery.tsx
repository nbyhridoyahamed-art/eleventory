"use client";

import { useRef, useState } from "react";
import { ImagePlus, Images, Loader2, Star, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useAttachProductImage,
  useDeleteProductImage,
  useMarkPrimaryProductImage,
  useUploadProductImage,
} from "@/hooks/use-products";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MediaPickerDialog } from "@/components/settings/media-picker-dialog";
import type { ProductImage } from "@/types/product";

export function ProductImageGallery({ productId, images }: { productId: number; images: ProductImage[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: currentUser } = useCurrentUser();
  const upload = useUploadProductImage(productId);
  const attach = useAttachProductImage(productId);
  const remove = useDeleteProductImage(productId);
  const markPrimary = useMarkPrimaryProductImage(productId);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) upload.mutate(file);
    event.target.value = "";
  };

  return (
    <div className="space-y-4">
      {images.length === 0 && !upload.isPending ? (
        <EmptyState
          icon={<ImagePlus />}
          title="No images yet"
          description="Add at least one image so customers can see this product."
          action={
            <div className="flex justify-center gap-2">
              <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
                Upload image
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                Browse library
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image) => (
            <div key={image.id} className="group relative overflow-hidden rounded-md border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote storage URL, not a static asset */}
              <img src={image.url} alt={image.alt_text ?? ""} className="aspect-square w-full object-cover" />

              {image.is_primary ? (
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-on-primary">
                  <Star className="size-3 fill-current" />
                  Primary
                </span>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                {!image.is_primary ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-white hover:bg-white/20 hover:text-white"
                    aria-label="Set as primary"
                    onClick={() => markPrimary.mutate(image.id)}
                  >
                    <Star className="size-3.5" />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-white hover:bg-white/20 hover:text-white"
                  aria-label="Delete image"
                  onClick={() => remove.mutate(image.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            aria-label="Upload image"
            className={cn(
              "flex aspect-square items-center justify-center rounded-md border border-dashed border-border text-text-muted transition-colors hover:border-primary hover:text-primary",
              upload.isPending && "pointer-events-none opacity-50",
            )}
          >
            {upload.isPending ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          </button>

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={attach.isPending}
            aria-label="Browse media library"
            className={cn(
              "flex aspect-square items-center justify-center rounded-md border border-dashed border-border text-text-muted transition-colors hover:border-primary hover:text-primary",
              attach.isPending && "pointer-events-none opacity-50",
            )}
          >
            {attach.isPending ? <Loader2 className="size-5 animate-spin" /> : <Images className="size-5" />}
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        className="hidden"
        onChange={handleFileChange}
      />

      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        storeId={currentUser?.current_store_id}
        onSelect={(media) => attach.mutate(media.id)}
      />
    </div>
  );
}
