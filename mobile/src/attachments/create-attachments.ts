import { fetch as expoFetch } from "expo/fetch";
import type { SqlExecutor } from "../db/sql.ts";
import type { AuthController } from "../auth/auth-controller.ts";
import type { CredentialStore } from "../auth/credential-store.ts";
import type { SessionRequests } from "../auth/session-requests.ts";
import { createScopedApiClient } from "../api/create-scoped-api-client.ts";
import { acceptedEvidenceOwner } from "./accepted-owner.ts";
import { AttachmentStore } from "./attachment-store.ts";
import { EvidenceSession } from "./evidence-session.ts";
import { EvidenceCapture } from "./capture-evidence.ts";
import { nativeOwnedFiles } from "./native-owned-files.ts";
import { PrivateAttachmentTransport } from "./attachment-transport.ts";
import { AttachmentSync } from "./attachment-sync.ts";

/** Native HTTP is injected into the generated client; no operation bypasses that client. */
interface AttachmentDeps {
  db: SqlExecutor;
  auth: AuthController;
  tokens: CredentialStore;
  deviceId: string;
  requests: SessionRequests;
}
export function createAttachments(deps: AttachmentDeps) {
  const store = new AttachmentStore(deps.db);
  const session = new EvidenceSession({
    store,
    current: () => currentOwner(deps),
    isFinal: () => deps.tokens.getSnapshot().status === "ended",
  });
  const files = nativeOwnedFiles();
  const transport = new PrivateAttachmentTransport({
    requests: deps.requests,
    client: () =>
      createScopedApiClient({
        tokens: deps.tokens,
        fetch: (request) => expoFetch(request, { redirect: "error", credentials: "omit" }),
      }),
    assertCurrent: (fence) => session.assertCurrent(fence),
    requireActor: (fence) => {
      session.requireActor(fence);
    },
    requireAttempt: (call) =>
      store.requireAttempt({
        id: call.file.id,
        fence: call.fence,
        attemptVersion: call.attemptVersion,
      }),
  });
  const sync = new AttachmentSync({ store, session, files, transport, now: () => new Date() });
  return { store, session, capture: new EvidenceCapture({ store, session, files }), sync };
}
function currentOwner(deps: AttachmentDeps) {
  return acceptedEvidenceOwner({
    profile: deps.auth.getSnapshot().profile,
    credentials: deps.tokens.getSnapshot(),
    deviceId: deps.deviceId,
  });
}
export type Attachments = ReturnType<typeof createAttachments>;
