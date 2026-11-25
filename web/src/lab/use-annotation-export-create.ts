import { ApiError, unwrap } from "@wolbachia/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import { reportSessionError } from "../session/session-events";
import { currentRevision } from "../session/session-revision";
import { useSessionGuard } from "../session/use-session-guard";
import type { LabScope } from "./lab-query";
import type { AnnotationExportRequest } from "./annotation-export-query";

export type ExportCreateStatus = "idle" | "pending" | "queued" | "tooMany" | "failed";

function failureStatus(error: unknown): ExportCreateStatus {
  if (!(error instanceof ApiError)) return "failed";
  const code = error.envelope?.fields?.["date_to"]?.[0]?.code ?? error.code;
  return code === "annotation_export_too_many_images" ? "tooMany" : "failed";
}

/** A job request is submitted once, explicitly; failures retain the form inputs. */
function useCreateState(scope: LabScope) {
  const cache = useQueryClient();
  const begin = useSessionGuard();
  const isRunning = useRef(false);
  const [status, setStatus] = useState<ExportCreateStatus>("idle");
  return { scope, cache, begin, isRunning, status, setStatus };
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
  try {
    unwrap(
      await state.scope.client.POST("/api/v1/lab/egg-annotation-exports/", {
        body,
        signal: guard.signal,
      }),
    );
    if (guard.isStale()) return;
    void invalidateOrgScoped(state.cache, "lab");
    state.setStatus("queued");
  } catch (error) {
    if (guard.isStale()) return;
    reportSessionError(error, state.cache);
    state.setStatus(failureStatus(error));
  } finally {
    state.isRunning.current = false;
  }
}

/** Session ownership and a synchronous gate protect the single submitted job request. */
export function useAnnotationExportCreate(scope: LabScope) {
  const state = useCreateState(scope);
  return {
    status: state.status,
    submit: (body: AnnotationExportRequest) => submitExport(state, body),
  };
}
