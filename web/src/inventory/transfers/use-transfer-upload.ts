import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reportSessionError } from "../../session/session-events";
import type { useInventoryContext } from "../use-inventory-context";
import { isTransferEvidenceFile, uploadTransferEvidence } from "./transfer-evidence";
import type { TransferUpload } from "./transfer-evidence";

export type TransferUploadScope = Pick<
  ReturnType<typeof useInventoryContext>,
  "client" | "identity" | "isCurrentRead" | "beginWrite"
>;
interface UploadState {
  proof: TransferUpload | null;
  status: "idle" | "uploading" | "failed" | "verified";
}
interface UploadContext {
  scope: TransferUploadScope;
  cache: ReturnType<typeof useQueryClient>;
  locked: { current: symbol | null };
  setState: Dispatch<SetStateAction<UploadState>>;
  onVerified: { current: (id: string) => void };
  isMounted: { current: boolean };
}
function isCurrent(context: UploadContext, guard: ReturnType<TransferUploadScope["beginWrite"]>) {
  return context.isMounted.current && !guard.isStale() && context.scope.isCurrentRead();
}
async function verifyUpload(
  context: UploadContext,
  proof: TransferUpload,
  guard: ReturnType<TransferUploadScope["beginWrite"]>,
) {
  const requireCurrent = () => {
    if (!isCurrent(context, guard)) throw new Error("Stale transfer upload");
  };
  const answer = await uploadTransferEvidence({
    client: context.scope.client,
    evidence: proof,
    signal: guard.signal,
    requireCurrent,
    onAuthorized: (uploadId) => {
      context.setState({ proof: { ...proof, uploadId }, status: "uploading" });
    },
  });
  requireCurrent();
  context.setState({ proof: { ...proof, ...answer }, status: "verified" });
  context.onVerified.current(answer.uploadId);
}
async function upload(context: UploadContext, proof: TransferUpload) {
  if (
    context.locked.current ||
    !context.scope.identity.isSettled ||
    !context.scope.identity.permissions?.includes("field.upload")
  )
    return;
  const guard = context.scope.beginWrite();
  if (!isCurrent(context, guard)) return;
  const token = Symbol();
  context.locked.current = token;
  context.setState({ proof, status: "uploading" });
  try {
    await verifyUpload(context, proof, guard);
  } catch (error) {
    if (isCurrent(context, guard)) {
      context.setState((state) => ({ ...state, status: "failed" }));
      reportSessionError(error, context.cache);
    }
  } finally {
    if (context.locked.current === token) context.locked.current = null;
  }
}
function selectFile(context: UploadContext, file?: File) {
  if (context.locked.current) return;
  context.onVerified.current("");
  context.setState({
    proof: file ? { file, clientId: crypto.randomUUID() } : null,
    status: "idle",
  });
}
function useInterruptedUpload(context: UploadContext, state: UploadState) {
  const previousRevision = useRef(context.scope.identity.revision);
  useEffect(() => {
    if (
      previousRevision.current !== context.scope.identity.revision &&
      state.status === "uploading"
    ) {
      context.locked.current = null;
      context.setState((current) => ({ ...current, status: "failed" }));
    }
    previousRevision.current = context.scope.identity.revision;
  }, [context, state.status]);
}
function useUploadLifecycle(onVerified: (id: string) => void) {
  const currentCallback = useRef(onVerified);
  currentCallback.current = onVerified;
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  return { onVerified: currentCallback, isMounted };
}
/** Manual retry keeps both the original file UUID and any already-authorized upload UUID. */
export function useTransferUpload(scope: TransferUploadScope, onVerified: (id: string) => void) {
  const cache = useQueryClient();
  const locked = useRef<symbol | null>(null);
  const lifecycle = useUploadLifecycle(onVerified);
  const [state, setState] = useState<UploadState>({ proof: null, status: "idle" });
  const context = { scope, cache, locked, setState, ...lifecycle };
  useInterruptedUpload(context, state);
  return {
    ...state,
    isBusy: state.status === "uploading",
    isInvalid: state.proof !== null && !isTransferEvidenceFile(state.proof.file),
    select: (file?: File) => {
      selectFile(context, file);
    },
    selectEvent: (event: ChangeEvent<HTMLInputElement>) => {
      selectFile(context, event.target.files?.[0]);
    },
    upload: () =>
      state.proof && !state.proof.verifiedAt ? upload(context, state.proof) : Promise.resolve(),
    verify: () => {
      if (state.proof && !state.proof.verifiedAt) void upload(context, state.proof);
    },
  };
}
