"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Star, Trash2, X } from "lucide-react";

import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/hooks/use-auth";
import { useApproveReview, useDeleteReview, useRejectReview, useReviews } from "@/hooks/use-reviews";
import { PermissionDenied } from "@/components/permission-denied";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Review, ReviewStatus } from "@/types/review";

type BadgeVariant = BadgeProps["variant"];

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_VARIANTS: Record<ReviewStatus, BadgeVariant> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

const RATINGS = [5, 4, 3, 2, 1];

export default function ReviewsPage() {
  const { data: currentUser } = useCurrentUser();
  const storeId = currentUser?.current_store_id;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [rating, setRating] = useState("all");
  const [reviewToDelete, setReviewToDelete] = useState<Review | null>(null);

  const { data, isLoading } = useReviews(storeId, {
    page,
    status: status !== "all" ? status : null,
    rating: rating !== "all" ? Number(rating) : null,
  });
  const approveReview = useApproveReview();
  const rejectReview = useRejectReview();
  const deleteReview = useDeleteReview();

  if (currentUser && !can(currentUser, "reviews.view")) {
    return <PermissionDenied />;
  }

  const canModerate = can(currentUser, "reviews.moderate");
  const canDelete = can(currentUser, "reviews.delete");

  const columns: DataTableColumn<Review>[] = [
    {
      id: "product",
      header: "Product",
      cell: (review) =>
        review.product ? (
          <Link href={`/dashboard/catalog/products/${review.product.id}`} className="font-medium text-primary hover:underline">
            {review.product.name}
          </Link>
        ) : (
          "—"
        ),
    },
    { id: "customer", header: "Customer", cell: (review) => review.customer_name ?? "—" },
    {
      id: "rating",
      header: "Rating",
      cell: (review) => (
        <span className="inline-flex items-center gap-1">
          <Star className="size-4 fill-warning text-warning" />
          {review.rating}/5
        </span>
      ),
    },
    {
      id: "review",
      header: "Review",
      cell: (review) => (
        <div className="max-w-sm">
          {review.title ? <p className="font-medium text-text-primary">{review.title}</p> : null}
          <p className="truncate text-text-secondary">{review.body}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (review) => <Badge variant={STATUS_VARIANTS[review.status]}>{STATUS_LABELS[review.status]}</Badge>,
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      cell: (review) => (
        <div className="flex justify-end gap-1">
          {canModerate && review.status === "pending" ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Approve review"
                loading={approveReview.isPending}
                onClick={() => approveReview.mutate(review.id)}
              >
                <Check className="text-success" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Reject review"
                loading={rejectReview.isPending}
                onClick={() => rejectReview.mutate(review.id)}
              >
                <X className="text-danger" />
              </Button>
            </>
          ) : null}
          {canDelete ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete review"
              onClick={() => setReviewToDelete(review)}
            >
              <Trash2 className="text-danger" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={rating}
          onValueChange={(v) => {
            setRating(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by rating">
            <SelectValue placeholder="All ratings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            {RATINGS.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value} star{value === 1 ? "" : "s"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(review) => review.id}
        isLoading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={<Star />}
            title="No reviews yet"
            description="Customer reviews submitted from a delivered order will appear here for moderation."
          />
        }
      />

      <Dialog open={Boolean(reviewToDelete)} onOpenChange={(open) => !open && setReviewToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete review</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteReview.isPending}
              onClick={() => {
                if (reviewToDelete) {
                  deleteReview.mutate(reviewToDelete.id, {
                    onSuccess: () => setReviewToDelete(null),
                  });
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
