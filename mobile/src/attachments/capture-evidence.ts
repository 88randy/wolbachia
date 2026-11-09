import { copyOwned, readVerified } from "./owned-files.ts";
import type { PrivateFiles } from "./owned-files.ts";
import { EvidenceError, EVIDENCE_UUID } from "./types.ts";
import type { EvidenceFence } from "./types.ts";
import type { AttachmentStore } from "./attachment-store.ts";
import type { EvidenceSession } from "./evidence-session.ts";
import type {
  Evidence,
  EvidencePort,
  EvidenceCaptureContext,
  CapturedEvidence,
} from "../features/ovitrap-check/types.ts";
import type { SqlStatement } from "../db/sql.ts";
import { guardPrivateFiles } from "./guard-private-files.ts";
import { requireCaptureSignal } from "./capture-signal.ts";

/** Only a new port-supplied capture is adopted; legacy DB references are never reassigned. */
interface CaptureDeps {
  readonly files: PrivateFiles;
  readonly store: AttachmentStore;
  readonly session: EvidenceSession;
}
interface Adoption {
  readonly evidence: Evidence;
  readonly context: EvidenceCaptureContext & { guard: SqlStatement };
  readonly fence: EvidenceFence;
}
export class EvidenceCapture {
  readonly deps: CaptureDeps;
  constructor(deps: CaptureDeps) {
    this.deps = deps;
  }

  async capture(
    port: EvidencePort,
    context: EvidenceCaptureContext & { guard: SqlStatement },
  ): Promise<CapturedEvidence | null> {
    const fence = await this.deps.session.capture();
    const assertCurrent = async () => {
      requireCaptureSignal(context.signal);
      await context.assertCurrent();
      await this.deps.session.assertCurrent(fence);
      requireCaptureSignal(context.signal);
    };
    await assertCurrent();
    const evidence = await port.capture({ ...context, assertCurrent });
    await assertCurrent();
    if (evidence === null) return null;
    const owned = await this.#adopt({
      evidence: { ...evidence, id: evidence.id.toLowerCase() },
      context: { ...context, assertCurrent },
      fence,
    });
    return {
      ...owned,
      authority: this.deps.store.captureAuthority({ ...owned, draftId: context.draftId, fence }),
    };
  }

  async #adopt(input: Adoption): Promise<Evidence> {
    const { evidence, context, fence } = input;
    if (!EVIDENCE_UUID.test(evidence.id)) throw new EvidenceError("file_identity");
    await this.deps.store.reserveCapture({
      id: evidence.id,
      draftId: context.draftId,
      fence,
      guard: context.guard,
    });
    try {
      return await this.#own(input);
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
  async #own({ evidence, context, fence }: Adoption): Promise<Evidence> {
    const files = guardPrivateFiles(this.deps.files, context.assertCurrent);
    const file = await copyOwned({ files, id: evidence.id, source: evidence.fileRef });
    await readVerified(files, file);
    await context.assertCurrent();
    await this.deps.store.saveOwned(file, fence);
    await context.assertCurrent();
    return { id: file.id, fileRef: file.fileRef };
  }
}
