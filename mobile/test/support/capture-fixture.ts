import { EvidenceCapture } from "../../src/attachments/capture-evidence.ts";
import type {
  EvidenceCaptureContext,
  EvidencePort,
} from "../../src/features/ovitrap-check/types.ts";
import type { SqlStatement } from "../../src/db/sql.ts";
import { OvitrapStore } from "../../src/features/ovitrap-check/store.ts";
import { EvidenceError } from "../../src/attachments/types.ts";
import { makeDraft } from "./m-08-fixtures.ts";

/** Existing transport/file cases now provide a real unsaved draft, not an unconditional guard. */
export class FixtureEvidenceCapture extends EvidenceCapture {
  override async capture(
    port: EvidencePort,
    input: string | (EvidenceCaptureContext & { guard: SqlStatement }),
  ) {
    if (typeof input !== "string") return super.capture(port, input);
    const store = new OvitrapStore(this.deps.store.db);
    await store.begin(makeDraft({ eventId: input, shiftId: input }));
    const guard = store.evidenceCaptureGuard(input);
    return super.capture(port, {
      draftId: input,
      guard,
      signal: new AbortController().signal,
      assertCurrent: async () => {
        if (!(await this.deps.store.db.query(guard.sql, guard.params)).length)
          throw new EvidenceError("stale_context");
      },
    });
  }
}
