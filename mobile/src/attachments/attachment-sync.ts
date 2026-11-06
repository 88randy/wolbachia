import { ApiError } from "@wolbachia/api-client";
import { readVerified } from "./owned-files.ts";
import type { PrivateFiles } from "./owned-files.ts";
import type { AttachmentStore } from "./attachment-store.ts";
import type { AttachmentTransport, UploadCall } from "./attachment-transport.ts";
import type { EvidenceSession } from "./evidence-session.ts";
import { EvidenceError, UPLOAD_DEADLINE_MS } from "./types.ts";
import type { EvidenceFence, StoredEvidence } from "./types.ts";
import { backoffDelayMs } from "../sync/backoff.ts";
import { withinDeadline } from "./deadline.ts";

/** File attempts run ONLY when the owning SyncEngine invokes this step. */
interface SyncDeps {
  readonly store: AttachmentStore;
  readonly session: EvidenceSession;
  readonly files: PrivateFiles;
  readonly transport: AttachmentTransport;
  readonly now: () => Date;
  readonly deadlineMs?: number;
  readonly createDeadline?: (milliseconds: number) => AbortSignal;
}
type AttemptCall = UploadCall & { readonly attemptVersion: number };
export class AttachmentSync {
  readonly deps: SyncDeps;
  constructor(deps: SyncDeps) {
    this.deps = deps;
  }

  async advanceOne(): Promise<boolean> {
    const selection = await this.deps.session.selection();
    if (selection.isFinal || selection.fence === null) return false;
    const pending = await this.deps.store.next(selection.fence, this.deps.now().toISOString());
    if (pending === null) return false;
    const call = await this.#prepareCall(pending, selection.fence);
    if (call === null) return false;
    try {
      return await withinDeadline(call.signal, () => this.#transfer(pending, call));
    } catch (error) {
      await this.#saveFailure(pending, call, error);
      return false;
    }
  }

  async #prepareCall(pending: StoredEvidence, fence: EvidenceFence): Promise<AttemptCall | null> {
    const attemptVersion = await this.deps.store.beginAttempt(pending.file.id, fence);
    if (attemptVersion === null) return null;
    return {
      file: pending.file,
      fence,
      attemptVersion,
      signal: (this.deps.createDeadline ?? AbortSignal.timeout)(
        this.deps.deadlineMs ?? UPLOAD_DEADLINE_MS,
      ),
      ...(pending.parentEventId === null ? {} : { parentEventId: pending.parentEventId }),
    };
  }
  #saveFailure(pending: StoredEvidence, call: AttemptCall, error: unknown): Promise<void> {
    const delay = backoffDelayMs(pending.attempts + 1, 0.5);
    return this.deps.store.saveFailure({
      id: pending.file.id,
      fence: call.fence,
      code: errorCode(error),
      retryAt: new Date(this.deps.now().getTime() + delay).toISOString(),
      attemptVersion: call.attemptVersion,
    });
  }

  async #transfer(pending: StoredEvidence, call: AttemptCall): Promise<boolean> {
    if (pending.state === "verified")
      return this.#save(call, "verified", await this.deps.transport.finalize(call));
    const bytes = await readVerified(this.deps.files, pending.file);
    const resume =
      pending.state === "ready"
        ? await this.deps.transport.authorize(call)
        : await this.deps.transport.renew(call);
    if (resume.state === "verified") {
      if (resume.verifiedAt === null) throw new EvidenceError("upload_unverified");
      const verifiedAt =
        call.parentEventId === undefined
          ? resume.verifiedAt
          : await this.deps.transport.finalize(call);
      return this.#save(call, "verified", verifiedAt);
    }
    if (!(await this.#save(call, resume.state))) throw new EvidenceError("stale_context");
    if (resume.state === "authorized") {
      await this.deps.transport.put(call, bytes, resume.grant);
      if (!(await this.#save(call, "received"))) throw new EvidenceError("stale_context");
    }
    return this.#save(call, "verified", await this.deps.transport.finalize(call));
  }

  #save(call: AttemptCall, state: StoredEvidence["state"], verifiedAt?: string): Promise<boolean> {
    return this.deps.store.saveProgress({
      id: call.file.id,
      fence: call.fence,
      state,
      isBound: state === "verified" && call.parentEventId !== undefined,
      attemptVersion: call.attemptVersion,
      ...(verifiedAt === undefined ? {} : { verifiedAt }),
    });
  }

  nextRetryDelayMs = (): Promise<number | null> =>
    this.deps.store.nextRetryDelayMs(this.deps.now().getTime());
}
function errorCode(error: unknown): string {
  if (error instanceof EvidenceError) return error.code;
  if (error instanceof ApiError) return error.code;
  return "upload_retry";
}
