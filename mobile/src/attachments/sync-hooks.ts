import type { SyncPassDeps } from "../sync/sync-pass.ts";
import type { AttachmentStore } from "./attachment-store.ts";
import type { EvidenceSession } from "./evidence-session.ts";
import type { AttachmentSync } from "./attachment-sync.ts";
export function attachmentSyncHooks(input: {
  store: AttachmentStore;
  session: EvidenceSession;
  sync: AttachmentSync;
}): NonNullable<SyncPassDeps["attachments"]> {
  return {
    selection: input.session.selection,
    recoverInterrupted: async () => {
      await input.session.selection();
      await input.store.recoverInterrupted();
    },
    advanceOne: () => input.sync.advanceOne(),
    nextRetryDelayMs: input.sync.nextRetryDelayMs,
    retryNow: async () => {
      const { fence } = await input.session.selection();
      if (fence !== null) await input.store.retryNow(fence);
    },
  };
}
