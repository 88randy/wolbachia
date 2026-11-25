import { unwrap } from "@wolbachia/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useLanguage } from "../i18n/use-language";
import { reportSessionError } from "../session/session-events";
import { currentRevision } from "../session/session-revision";
import { useSessionGuard } from "../session/use-session-guard";
import type { LabScope } from "./lab-query";
import type { AnnotationExportRequest } from "./annotation-export-query";
import { exportFailure } from "./annotation-export-error";
import type { ExportFailure } from "./annotation-export-error";

export type ExportCreateStatus = "idle" | "pending" | "queued" | "failed";

/** A job request is submitted once, explicitly; failures retain the form inputs. */
function useCreateState(scope: LabScope) {
  const cache = useQueryClient();
  const begin = useSessionGuard();
  const isRunning = useRef(false);
  const [status, setStatus] = useState<ExportCreateStatus>("idle");
  const [failure, setFailure] = useState<ExportFailure | null>(null);
  const { language } = useLanguage();
  return { scope, cache, begin, isRunning, status, setStatus, failure, setFailure, language };
}

function refreshExportHistory(state: ReturnType<typeof useCreateState>) {
  const identity = state.scope.identity;
  void state.cache.invalidateQueries({
    queryKey: ["org", identity.userId, identity.organizationSlug, "lab", "annotation-exports"],
  });
  state.setStatus("queued");
}

function recordExportFailure(state: ReturnType<typeof useCreateState>, error: unknown) {
  reportSessionError(error, state.cache);
  const failure = exportFailure(error, state.language);
  state.setFailure(failure);
  state.setStatus("failed");
  return failure;
}

async function submitExport(
  state: ReturnType<typeof useCreateState>,
  body: AnnotationExportRequest,
) {
  if (state.isRunning.current || !state.scope.identity.isSettled) return;
  if (state.scope.identity.revision !== currentRevision()) return;
  const guard = state.begin();
  if (guard.isStale()) return;
  state.isRunning.current = true;
  state.setStatus("pending");
  state.setFailure(null);
  try {
    unwrap(
      await state.scope.client.POST("/api/v1/lab/egg-annotation-exports/", {
        body,
        signal: guard.signal,
      }),
    );
    if (guard.isStale()) return;
    refreshExportHistory(state);
  } catch (error) {
    if (guard.isStale()) return;
    return recordExportFailure(state, error);
  } finally {
    state.isRunning.current = false;
  }
}

/** Session ownership and a synchronous gate protect the single submitted job request. */
export function useAnnotationExportCreate(scope: LabScope) {
  const state = useCreateState(scope);
  return {
    status: state.status,
    failure: state.failure,
    submit: (body: AnnotationExportRequest) => submitExport(state, body),
  };
}
