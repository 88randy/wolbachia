import type { AuthProfile } from "../auth/auth-state.ts";
import type { Credentials } from "../auth/credential-store.ts";
import type { EvidenceIdentity } from "./evidence-session.ts";

/** Fresh identity alone cannot prove that an older session's files belong to this actor. */
export function acceptedEvidenceOwner(input: {
  profile: AuthProfile | null;
  credentials: Credentials;
  deviceId: string;
}): EvidenceIdentity | null {
  const { profile, credentials, deviceId } = input;
  if (
    !profile?.userId ||
    !profile.organization ||
    !credentials.sessionId ||
    !credentials.origin ||
    !credentials.pair ||
    credentials.status !== "active" ||
    profile.sessionId !== credentials.sessionId ||
    profile.issuer !== credentials.origin
  )
    return null;
  return {
    sessionId: credentials.sessionId,
    owner: {
      issuer: credentials.origin,
      organizationId: profile.organization.id,
      userId: profile.userId,
      deviceId,
    },
  };
}
