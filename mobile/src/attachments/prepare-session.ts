import type { SqlExecutor } from "../db/sql.ts";
import type { AuthProfile } from "../auth/auth-state.ts";
import type { Credentials } from "../auth/credential-store.ts";
import { acceptedEvidenceOwner } from "./accepted-owner.ts";
import { AttachmentStore } from "./attachment-store.ts";
import { EvidenceError } from "./types.ts";

/** Before activating credentials, SQL arbitrates login versus an adopted-only file reservation. */
export async function prepareEvidenceSession(input: {
  db: SqlExecutor;
  deviceId: string;
  profile: AuthProfile;
  credentials: Credentials;
}): Promise<boolean> {
  const identity = acceptedEvidenceOwner(input);
  try {
    await new AttachmentStore(input.db).bindSession(identity, true);
    return true;
  } catch (error) {
    if (error instanceof EvidenceError && error.code === "owner_conflict") return false;
    throw error;
  }
}
