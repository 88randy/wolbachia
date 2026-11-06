import { copyOwned, readVerified } from "./owned-files.ts";
import type { PrivateFiles } from "./owned-files.ts";
import { EvidenceError, EVIDENCE_UUID } from "./types.ts";
import type { EvidenceFence } from "./types.ts";
import type { AttachmentStore } from "./attachment-store.ts";
import type { EvidenceSession } from "./evidence-session.ts";
import type { Evidence, EvidencePort } from "../features/ovitrap-check/types.ts";

/** Only a new port-supplied capture is adopted; legacy DB references are never reassigned. */
interface CaptureDeps {
  readonly files: PrivateFiles;
  readonly store: AttachmentStore;
  readonly session: EvidenceSession;
}
export class EvidenceCapture {
  readonly deps: CaptureDeps;
  constructor(deps: CaptureDeps) {
    this.deps = deps;
  }

  async capture(port: EvidencePort, draftId: string): Promise<Evidence | null> {
    const fence = await this.deps.session.capture();
    const evidence = await port.capture();
    await this.deps.session.assertCurrent(fence);
    if (evidence === null) return null;
    return this.#adopt({
      evidence: { ...evidence, id: evidence.id.toLowerCase() },
      draftId,
      fence,
    });
  }

  async #adopt(input: {
    evidence: Evidence;
    draftId: string;
    fence: EvidenceFence;
  }): Promise<Evidence> {
    const { evidence, draftId, fence } = input;
    if (!EVIDENCE_UUID.test(evidence.id)) throw new EvidenceError("file_identity");
    await this.deps.store.reserve({ id: evidence.id, draftId, fence });
    try {
      const file = await copyOwned({
        files: this.deps.files,
        id: evidence.id,
        source: evidence.fileRef,
      });
      await readVerified(this.deps.files, file);
      await this.deps.session.assertCurrent(fence);
      await this.deps.store.saveOwned(file, fence);
      return { id: file.id, fileRef: file.fileRef };
    } catch (error) {
      await this.deps.store.saveFailure({
        id: evidence.id,
        fence,
        code: error instanceof EvidenceError ? error.code : "file_unavailable",
        retryAt: new Date(0).toISOString(),
      });
      throw error;
    }
  }
}
