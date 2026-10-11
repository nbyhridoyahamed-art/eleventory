"use client";

import Link from "next/link";
import { MessageSquare, Star } from "lucide-react";

import { useAccountReviews } from "@/hooks/use-reviews";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/storefront/panel";
import type { ReviewStatus } from "@/types/review";

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending approval",
  approved: "Published",
  rejected: "Not approved",
};

const STATUS_VARIANTS: Record<ReviewStatus, BadgeProps["variant"]> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`size-4 ${n <= value ? "fill-shop-accent text-shop-accent" : "text-border"}`} />
      ))}
    </div>
  );
}

export default function AccountReviewsPage() {
  const { data: reviews, isLoading } = useAccountReviews();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <Panel title="My reviews">
        <div className="flex flex-col items-center gap-3 px-2 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-shop-tint text-shop-ink">
            <MessageSquare className="size-6" />
          </span>
          <p className="font-semibold text-text-primary">No reviews yet</p>
          <p className="max-w-sm text-sm text-text-secondary">
            Reviews you write from a delivered order will show up here, along with their approval status.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Panel key={review.id}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {review.product ? (
                <Link href={`/products/${review.product.slug}`} className="font-semibold text-shop-ink hover:underline">
                  {review.product.name}
                </Link>
              ) : (
                <span className="font-semibold text-text-primary">Product</span>
              )}
              <Badge variant={STATUS_VARIANTS[review.status]}>{STATUS_LABELS[review.status]}</Badge>
            </div>
            <Stars value={review.rating} />
            {review.title ? <p className="font-medium text-text-primary">{review.title}</p> : null}
            <p className="text-sm text-text-secondary">{review.body}</p>
            <p className="text-xs text-text-muted">{new Date(review.created_at).toLocaleDateString()}</p>
          </div>
        </Panel>
      ))}
    </div>
  );
}
