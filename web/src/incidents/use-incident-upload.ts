import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionGuard } from "../session/use-session-guard";
import { reportSessionError } from "../session/session-events";
import { uploadIncidentEvidence, isEvidenceFile } from "./incident-evidence";
import type { IncidentUpload } from "./incident-evidence";
import type { IncidentScope } from "./incidents-query";
interface UploadContext {
  scope: IncidentScope;
  id: string;
  begin: ReturnType<typeof useSessionGuard>;
  cache: ReturnType<typeof useQueryClient>;
  locked: { current: symbol | null };
  setBusy: (busy: boolean) => void;
  setFailed: (failed: boolean) => void;
  onVerified: (id: string) => void;
  setProof: Dispatch<SetStateAction<IncidentUpload | null>>;
}
type UploadGuard = ReturnType<UploadContext["begin"]>;
async function verifyUpload(context: UploadContext, proof: IncidentUpload, guard: UploadGuard) {
  const requireCurrent = () => {
    if (guard.isStale()) throw new Error("Stale incident upload");
  };
  const verified = await uploadIncidentEvidence({
    scope: context.scope,
    incident: context.id,
    evidence: proof,
    signal: guard.signal,
    requireCurrent,
    onAuthorized: (id) => {
      context.setProof({ ...proof, uploadId: id });
    },
  });
  requireCurrent();
  context.setProof({ ...proof, ...verified });
  context.onVerified(verified.uploadId);
}
async function upload(context: UploadContext, proof: IncidentUpload) {
  if (context.locked.current || !context.scope.identity.isSettled) return;
  const guard = context.begin();
  if (guard.isStale()) return;
  const token = Symbol();
  context.locked.current = token;
  context.setBusy(true);
  context.setFailed(false);
  try {
    await verifyUpload(context, proof, guard);
  } catch (error) {
    if (!guard.isStale()) {
      context.setFailed(true);
      reportSessionError(error, context.cache);
    }
  } finally {
    if (context.locked.current === token && !guard.isStale()) {
      context.locked.current = null;
      context.setBusy(false);
    }
  }
}
/** Each selected file keeps its client UUID and upload UUID across manual renew/retry. */
interface UploadTarget {
  id: string;
  onVerified: (id: string) => void;
}
export function useIncidentUpload(scope: IncidentScope, target: UploadTarget) {
  const begin = useSessionGuard();
  const cache = useQueryClient();
  const locked = useRef<symbol | null>(null);
  const previousRevision = useRef(scope.identity.revision);
  const [proof, setProof] = useState<IncidentUpload | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [hasFailed, setFailed] = useState(false);
  useEffect(() => {
    if (previousRevision.current !== scope.identity.revision && isBusy) {
      locked.current = null;
      setBusy(false);
      setFailed(true);
    }
    previousRevision.current = scope.identity.revision;
  }, [scope.identity.revision, isBusy]);
  const context = { scope, ...target, begin, cache, locked, setBusy, setFailed, setProof };
  return {
    proof,
    isBusy,
    hasFailed,
    select: (file?: File) => {
      if (!locked.current) setProof(file ? { file, clientId: crypto.randomUUID() } : null);
    },
    isInvalid: proof !== null && !isEvidenceFile(proof.file),
    upload: () => (proof && !proof.verifiedAt ? upload(context, proof) : Promise.resolve()),
  };
}
