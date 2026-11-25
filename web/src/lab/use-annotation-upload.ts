import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { annotationUploadFailure } from "./annotation-upload-error";
import { reportSessionError } from "../session/session-events";
import { useSessionGuard } from "../session/use-session-guard";
import type { SessionGuard } from "../session/use-session-guard";
import { currentRevision, isSessionKnown } from "../session/session-revision";
import { isAnnotationPhoto, uploadAnnotationPhoto } from "./annotation-upload";
import type { AnnotationPhoto, AnnotationUploadStage } from "./annotation-upload";
import type { LabScope } from "./lab-query";
import type { Dispatch, SetStateAction } from "react";
interface UploadState {
  photo?: AnnotationPhoto;
  stage?: AnnotationUploadStage;
  failure?: Schemas["FieldError"];
}
interface UploadContext {
  scope: LabScope;
  begin: ReturnType<typeof useSessionGuard>;
  cache: ReturnType<typeof useQueryClient>;
  locked: { current: boolean };
  setState: Dispatch<SetStateAction<UploadState>>;
}
type OriginalPhoto = { file: File; clientId: string };
/** Retain the user's intent while a same-session verification temporarily closes admission. */
function usePendingUpload(
  context: UploadContext,
  pending: { current?: OriginalPhoto },
  stage: AnnotationUploadStage | undefined,
) {
  const { scope, begin, cache, locked, setState } = context;
  useEffect(() => {
    const original = pending.current;
    if (stage !== "preparing" || !original || !scope.identity.isSettled || !isSessionKnown())
      return;
    pending.current = undefined;
    if (
      !scope.identity.permissions?.includes("field.upload") ||
      scope.identity.revision !== currentRevision()
    ) {
      locked.current = false;
      setState({ failure: { code: "permission_denied", params: {} } });
      return;
    }
    void verifyAnnotationUpload({ scope, begin, cache, locked, setState }, original);
  }, [scope, begin, cache, locked, setState, pending, stage]);
}
async function verifyAnnotationUpload(
  context: UploadContext,
  original: { file: File; clientId: string },
) {
  const guard = context.begin();
  if (guard.isStale()) return;
  context.locked.current = true;
  context.setState({ stage: "preparing" });
  try {
    const photo = await uploadAnnotationPhoto({
      client: context.scope.client,
      ...original,
      signal: guard.signal,
      requireCurrent: () => {
        requireUploadCurrent(guard);
      },
      onStage: (stage) => {
        if (!guard.isStale()) context.setState({ stage });
      },
    });
    if (!guard.isStale()) context.setState({ photo });
  } catch (error) {
    if (!guard.isStale()) {
      context.setState({ failure: annotationUploadFailure(error) });
      reportSessionError(error, context.cache);
    }
  } finally {
    context.locked.current = false;
  }
}
/** A synchronous lock retains one selection until session admission can verify it. */
export function useAnnotationUpload(scope: LabScope) {
  const begin = useSessionGuard();
  const cache = useQueryClient();
  const locked = useRef(false);
  const pending = useRef<OriginalPhoto | undefined>(undefined);
  const [state, setState] = useState<UploadState>({});
  usePendingUpload({ scope, begin, cache, locked, setState }, pending, state.stage);
  const upload = (file: File, clientId: string) => {
    if (locked.current) return Promise.resolve();
    if (!isAnnotationPhoto(file)) {
      setState({ failure: { code: "invalid", params: {} } });
      return Promise.resolve();
    }
    locked.current = true;
    pending.current = { file, clientId };
    setState({ stage: "preparing" });
    return Promise.resolve();
  };
  return { ...state, upload, isBusy: state.stage !== undefined };
}

function requireUploadCurrent(guard: SessionGuard) {
  if (guard.isStale()) throw new Error("Stale annotation upload");
}
