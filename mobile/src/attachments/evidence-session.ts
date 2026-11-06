import { EvidenceError, ownerKey } from "./types.ts";
import type { EvidenceFence, EvidenceOwner } from "./types.ts";
import type { AttachmentStore } from "./attachment-store.ts";
import type { EvidenceSelection } from "./evidence-eligibility.ts";

export interface EvidenceIdentity {
  readonly owner: EvidenceOwner;
  readonly sessionId: string;
}
interface SessionDeps {
  readonly store: AttachmentStore;
  readonly current: () => EvidenceIdentity | null;
  readonly isFinal: () => boolean;
}
/** Current credentials/profile must prove the original UUID, issuer and accepted session. */
export class EvidenceSession {
  readonly deps: SessionDeps;
  #tail: Promise<unknown> = Promise.resolve();
  constructor(deps: SessionDeps) {
    this.deps = deps;
  }

  selection = (): Promise<EvidenceSelection> => {
    const run = this.#tail.then(async () => {
      const identity = this.deps.current();
      const fence = await this.deps.store.bindSession(identity);
      if (fence !== null) await this.assertCurrent(fence);
      return { fence, isFinal: this.deps.isFinal() };
    });
    this.#tail = run.catch(() => undefined);
    return run;
  };

  async capture(): Promise<EvidenceFence> {
    const { fence } = await this.selection();
    if (fence === null) throw new EvidenceError("owner_unproven");
    return fence;
  }

  async assertCurrent(fence: EvidenceFence): Promise<void> {
    this.requireActor(fence);
    if (!(await this.deps.store.isCurrent(fence))) throw new EvidenceError("stale_context");
    this.requireActor(fence);
  }

  requireActor(fence: EvidenceFence): void {
    const identity = this.deps.current();
    if (
      identity === null ||
      ownerKey(identity.owner) !== fence.ownerKey ||
      identity.sessionId !== fence.sessionId
    )
      throw new EvidenceError("stale_context");
  }
}
