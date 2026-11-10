import { useEffect, useState } from "react";
import { isReadDenied } from "../read-access";
import { useQuery } from "@tanstack/react-query";
import { useVoidLimits } from "../../void/use-void-limits";
import { useOnlineStatus } from "../../shell/use-online-status";
import { reviewDetailOptions } from "./review-query";
import type { Review, ReviewScope } from "./review-query";
import { useReviewCommand } from "./use-review-command";

function useReviewRead(scope: ReviewScope, id: string) {
  const query = useQuery(reviewDetailOptions(scope, id));
  const isFresh =
    query.isSuccess && !query.isPlaceholderData && !query.isFetching && query.data.id === id;
  const isDenied = isReadDenied(query.error);
  const review =
    isDenied || query.isPlaceholderData || query.data?.id !== id ? undefined : query.data;
  const command = useReviewCommand({ scope, review: isFresh ? review : undefined, isFresh });
  const isReceiptObserved = hasObservedReceipt(review, command);
  async function refresh() {
    const result = await query.refetch();
    if (result.isSuccess && result.data.id === id && !result.isPlaceholderData) command.reset();
  }
  return { query, review, command, isFresh, refresh, isDenied, isReceiptObserved };
}

function hasObservedReceipt(
  review: Review | undefined,
  command: ReturnType<typeof useReviewCommand>,
): boolean {
  return review?.timeline.some((decision) => decision.id === command.status?.receipt?.id) ?? false;
}

/** Only the currently consumed matching read can authorize an explicit command. */
export function useReviewRecord({ scope, id }: { scope: ReviewScope; id: string }) {
  const [reason, setReason] = useState("");
  const read = useReviewRead(scope, id);
  const limits = useVoidLimits();
  const isOnline = useOnlineStatus();
  const isValid = reason.trim().length >= limits.minLength && reason.length <= limits.maxLength;
  const canDecide =
    !!read.review && scope.identity.permissions?.includes("review_item.decide") === true;
  const resetCommand = read.command.reset;
  useEffect(() => {
    if (read.isDenied) {
      setReason("");
      resetCommand();
    }
  }, [read.isDenied, resetCommand]);
  const isBlocked =
    !read.isFresh ||
    !isValid ||
    !isOnline ||
    read.command.isBusy ||
    read.command.needsReview ||
    read.review?.decision_state.terminal !== false;
  return { ...read, id, scope, limits, reason, setReason, canDecide, isBlocked };
}

export type ReviewRecordState = ReturnType<typeof useReviewRecord>;
