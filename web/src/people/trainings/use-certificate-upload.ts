import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionGuard } from "../../session/use-session-guard";
import { reportSessionError } from "../../session/session-events";
import { uploadCertificateEvidence, isCertificateImage } from "./certificate-evidence";
import type { CertificateEvidence } from "./certificate-evidence";
import type { TrainingScope } from "./training-query";
import { usePeopleGuard } from "../use-people-guard";
interface UploadRuntime {
  scope: TrainingScope;
  begin: ReturnType<typeof useSessionGuard>;
  cache: ReturnType<typeof useQueryClient>;
  busy: { current: symbol | null };
  setProof: (proof: CertificateEvidence) => void;
  setState: (state: "ready" | "busy" | "failed") => void;
  onVerified: (id: string) => void;
}
async function verifyImage(
  runtime: UploadRuntime,
  evidence: CertificateEvidence,
  guard: ReturnType<UploadRuntime["begin"]>,
) {
  const requireCurrent = () => {
    if (guard.isStale()) throw new Error("Stale certification upload");
  };
  const verified = await uploadCertificateEvidence({
    scope: runtime.scope,
    evidence,
    signal: guard.signal,
    requireCurrent,
    onAuthorized: (id) => {
      runtime.setProof({ ...evidence, uploadId: id });
    },
  });
  requireCurrent();
  runtime.setProof({ ...evidence, ...verified });
  runtime.onVerified(verified.uploadId);
  runtime.setState("ready");
}
async function transferImage(runtime: UploadRuntime, evidence: CertificateEvidence) {
  if (runtime.busy.current) return;
  const guard = runtime.begin();
  if (guard.isStale()) return;
  const token = Symbol();
  runtime.busy.current = token;
  runtime.setState("busy");
  try {
    await verifyImage(runtime, evidence, guard);
  } catch (error) {
    if (!guard.isStale()) {
      runtime.setState("failed");
      reportSessionError(error, runtime.cache);
    }
  } finally {
    if (runtime.busy.current === token) runtime.busy.current = null;
  }
}
/** A retained client/upload pair supports only deliberate renew/retry, never session replay. */
export function useCertificateUpload(scope: TrainingScope, onVerified: (id: string) => void) {
  const { begin } = usePeopleGuard(scope.identity);
  const cache = useQueryClient();
  const busy = useRef<symbol | null>(null);
  const [proof, setProof] = useState<CertificateEvidence>();
  const [state, setState] = useState<"ready" | "busy" | "failed">("ready");
  useEffect(() => {
    if (busy.current) {
      busy.current = null;
      setState("failed");
    }
  }, [scope.identity.revision, scope.identity.authorization, scope.identity.activeCenter]);
  const runtime = { scope, begin, cache, busy, setProof, setState, onVerified };
  function select(file?: File) {
    if (!busy.current) {
      setProof(file ? { file, clientId: crypto.randomUUID() } : undefined);
      setState("ready");
    }
  }
  const upload = () =>
    proof && !proof.verifiedAt ? transferImage(runtime, proof) : Promise.resolve();
  return {
    proof,
    state,
    select,
    upload,
    isInvalid: proof !== undefined && !isCertificateImage(proof.file),
  };
}
