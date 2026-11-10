import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { ApiError, unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { useReviewGuard } from "./use-review-guard";
import type { SessionGuard } from "../../session/use-session-guard";
import { reportSessionError } from "../../session/session-events";
import { invalidateOrgScoped } from "../../session/org-scoped-query";
import { useVoidLimits } from "../../void/use-void-limits";
import { useOnlineStatus } from "../../shell/use-online-status";
import { canReview, sendReview } from "./review-command";
import type { ReviewCommand } from "./review-command";
import type { Review, ReviewAction, ReviewScope } from "./review-query";

interface CommandState {
  revision: number;
  context: string;
  phase: "busy" | "review" | "saved";
  code?: string;
  receipt?: Schemas["ReviewDecision"];
}
interface Options {
  scope: ReviewScope;
  review?: Review;
  isFresh: boolean;
}
type StateSetter = (state: CommandState | null) => void;
interface AttemptContext {
  scope: ReviewScope;
  guard: SessionGuard;
  queryClient: QueryClient;
  setStatus: StateSetter;
  context: string;
}
interface AttemptRuntime extends Omit<AttemptContext, "guard"> {
  begin: () => SessionGuard;
  status: CommandState | null;
  attempt: RefObject<symbol | null>;
}

async function performReview(context: AttemptContext, command: ReviewCommand): Promise<boolean> {
  const revision = context.scope.identity.revision;
  try {
    const answer = await sendReview(context.scope.client, command);
    if (context.guard.isStale()) return false;
    const receipt = unwrap(answer);
    context.setStatus({ phase: "saved", revision, context: context.context, receipt });
    await invalidateOrgScoped(context.queryClient, "reviews");
    return true;
  } catch (error) {
    if (context.guard.isStale()) return false;
    context.setStatus({
      phase: "review",
      revision,
      context: context.context,
      code: error instanceof ApiError ? error.code : "network",
    });
    reportSessionError(error, context.queryClient);
    return false;
  }
}

async function issueReviewAttempt(runtime: AttemptRuntime, command: Omit<ReviewCommand, "signal">) {
  if (runtime.attempt.current || runtime.status !== null) return false;
  const guard = runtime.begin();
  if (guard.isStale()) return false;
  const token = Symbol();
  runtime.attempt.current = token;
  runtime.setStatus({
    phase: "busy",
    revision: runtime.scope.identity.revision,
    context: runtime.context,
  });
  try {
    return await performReview({ ...runtime, guard }, { ...command, signal: guard.signal });
  } finally {
    if (runtime.attempt.current === token) runtime.attempt.current = null;
  }
}
function useReviewAttempt(scope: ReviewScope) {
  const { begin, context } = useReviewGuard(scope);
  const queryClient = useQueryClient();
  const attempt = useRef<symbol | null>(null);
  const [status, setStatus] = useState<CommandState | null>(null);
  const revision = scope.identity.revision;
  const runtime = { begin, context, scope, queryClient, attempt, status, setStatus };
  const issue = (command: Omit<ReviewCommand, "signal">) => issueReviewAttempt(runtime, command);
  const reset = useCallback(() => {
    attempt.current = null;
    setStatus(null);
  }, []);
  return {
    status: status?.context === context ? status : null,
    issue,
    reset,
    isBusy: status?.phase === "busy" && status.revision === revision && status.context === context,
    needsReview: status !== null,
  };
}

function hasCurrentAction(options: Options, action: ReviewAction): boolean {
  const { review, scope } = options;
  if (!review || !options.isFresh || !scope.identity.isSettled) return false;
  if (!scope.identity.permissions?.includes("review_item.decide") || !canReview(review, action))
    return false;
  return action !== "open_incident" || scope.identity.permissions.includes("incident.create");
}

/** One frozen command per reviewed frame; uncertain/stale outcomes require explicit read, never replay. */
export function useReviewCommand(options: Options) {
  const attempt = useReviewAttempt(options.scope);
  const limits = useVoidLimits();
  const isOnline = useOnlineStatus();
  async function send(action: ReviewAction, reason: string) {
    const { review } = options;
    if (!review || !isOnline || !hasCurrentAction(options, action)) return false;
    if (reason.trim().length < limits.minLength || reason.length > limits.maxLength) return false;
    return attempt.issue({
      id: review.id,
      action,
      body: { reason, expected_revision: review.decision_state.revision },
    });
  }
  return { ...attempt, send };
}
