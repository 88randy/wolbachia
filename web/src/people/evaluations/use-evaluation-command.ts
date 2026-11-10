import { useRef, useState } from "react";
import type { RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { ApiError, unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { usePeopleGuard } from "../use-people-guard";
import type { SessionGuard } from "../../session/use-session-guard";
import { reportSessionError } from "../../session/session-events";
import { invalidateOrgScoped } from "../../session/org-scoped-query";
import type { EvaluationScope } from "./evaluation-query";
interface CommandState {
  phase: "busy" | "failed" | "saved";
  revision: number;
  context: string;
  receipt?: Schemas["PeopleReceipt"];
}
interface Runtime {
  scope: EvaluationScope;
  context: string;
  cache: QueryClient;
  active: RefObject<symbol | null>;
  status: CommandState | null;
  begin: () => SessionGuard;
  publish: (state: CommandState | null) => void;
  onDenied: () => void;
}
async function perform(
  runtime: Runtime,
  body: Schemas["EvaluationCreateRequest"],
  guard: SessionGuard,
) {
  const revision = runtime.scope.identity.revision;
  try {
    const receipt = unwrap(
      await runtime.scope.client.POST("/api/v1/evaluations/", { body, signal: guard.signal }),
    );
    if (guard.isStale()) return;
    runtime.publish({ phase: "saved", revision, context: runtime.context, receipt });
    void invalidateOrgScoped(runtime.cache, "evaluations");
  } catch (error) {
    if (guard.isStale()) return;
    if (error instanceof ApiError && [403, 404].includes(error.status)) runtime.onDenied();
    runtime.publish({ phase: "failed", revision, context: runtime.context });
    reportSessionError(error, runtime.cache);
  }
}
async function issue(runtime: Runtime, body: Schemas["EvaluationCreateRequest"]) {
  if (
    runtime.active.current ||
    runtime.status ||
    !runtime.scope.identity.permissions?.includes("evaluation.create")
  )
    return;
  const guard = runtime.begin();
  if (guard.isStale()) return;
  const token = Symbol();
  runtime.active.current = token;
  runtime.publish({
    phase: "busy",
    revision: runtime.scope.identity.revision,
    context: runtime.context,
  });
  try {
    await perform(runtime, body, guard);
  } finally {
    if (runtime.active.current === token) runtime.active.current = null;
  }
}
/** One deliberate immutable command; stale and uncertain responses never replay. */
export function useEvaluationCommand(scope: EvaluationScope, onDenied: () => void) {
  const { begin, context } = usePeopleGuard(scope.identity);
  const cache = useQueryClient();
  const active = useRef<symbol | null>(null);
  const [status, publish] = useState<CommandState | null>(null);
  const revision = scope.identity.revision;
  const runtime = { scope, begin, context, cache, active, status, publish, onDenied };
  return {
    status,
    context,
    send: (body: Schemas["EvaluationCreateRequest"]) => issue(runtime, body),
    isBusy: status?.phase === "busy" && status.revision === revision && status.context === context,
    needsReview:
      status !== null &&
      (status.phase === "failed" ||
        (status.phase === "busy" && (status.revision !== revision || status.context !== context))),
    requireReview: () => {
      publish({ phase: "failed", revision, context });
    },
    reset: () => {
      active.current = null;
      publish(null);
    },
  };
}
