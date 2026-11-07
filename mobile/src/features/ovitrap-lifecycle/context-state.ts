import { ownerKey } from "../../attachments/types.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { readInteger, readText } from "../../db/sql.ts";
import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { mutateCaptureAuthority } from "../ovitrap-check/snapshot-authority.ts";
import { readCaptureContext } from "./capture-context-contract.ts";
import type { CaptureTransportHandle } from "./capture-context-contract.ts";
import {
  CAPTURE_CONTEXT_KEY,
  CURRENT_AUTHORITY_REVISION,
  LIFECYCLE_BOOTSTRAP_PENDING,
} from "./context-sql.ts";

interface ContextState {
  readonly ready: boolean;
  readonly ownerKey?: string;
  readonly sessionId?: string;
  readonly scopeRevision?: string;
  readonly authorityRevision?: number;
  readonly previousRevision?: number | null;
}
async function readContextState(db: SqlExecutor) {
  const [row] = await db.query(
    `SELECT ${CURRENT_AUTHORITY_REVISION} AS revision,
    COALESCE((SELECT value FROM kv WHERE key=?),'{}') AS state`,
    [CAPTURE_CONTEXT_KEY],
  );
  if (!row) throw new Error("Missing capture authority read.");
  return {
    state: JSON.parse(readText(row, "state")) as ContextState,
    revision: readInteger(row, "revision"),
  };
}
function transportFromState(
  input: { state: ContextState; revision: number },
  identity: EvidenceIdentity,
  isCurrent: () => boolean,
): CaptureTransportHandle {
  const matches =
    input.state.ready &&
    input.state.authorityRevision === input.revision &&
    input.state.ownerKey === ownerKey(identity.owner) &&
    input.state.sessionId === identity.sessionId;
  return {
    owner: { ...identity.owner },
    sessionId: identity.sessionId,
    revision: input.revision,
    scopeRevision: matches ? (input.state.scopeRevision ?? null) : null,
    isCurrent,
  };
}
export async function readCaptureTransport(
  db: SqlExecutor,
  identity: EvidenceIdentity | null,
  isCurrent: () => boolean,
): Promise<CaptureTransportHandle | null> {
  if (identity === null) return null;
  return transportFromState(await readContextState(db), identity, isCurrent);
}
/** Renew only the just-committed predecessor chain, under the ORIGINAL transport fence. */
export async function advanceCaptureTransport(
  db: SqlExecutor,
  original: CaptureTransportHandle | null,
): Promise<CaptureTransportHandle | null> {
  if (original === null) return null;
  if (!original.isCurrent()) throw new Error("Capture transport changed.");
  const snapshot = await readContextState(db);
  if (
    !original.isCurrent() ||
    snapshot.state.previousRevision !== original.revision ||
    snapshot.state.authorityRevision !== snapshot.revision
  )
    throw new Error("Capture publication changed before continuation.");
  return transportFromState(snapshot, original, original.isCurrent);
}
/** SQL CAS runs before any projection mutation, including absent/null ABA. */
export function captureContextCas(handle: CaptureTransportHandle | null): readonly SqlStatement[] {
  if (handle === null) return [];
  if (!handle.isCurrent()) throw new Error("Capture transport changed.");
  return [
    {
      sql: `INSERT INTO kv(key,value) VALUES(?,CASE WHEN ${CURRENT_AUTHORITY_REVISION}=?
    THEN COALESCE((SELECT value FROM kv WHERE key=?),'{"ready":false}') ELSE NULL END)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      params: [CAPTURE_CONTEXT_KEY, handle.revision, CAPTURE_CONTEXT_KEY],
    },
  ];
}
interface PublicationInput {
  body: unknown;
  handle: CaptureTransportHandle | null;
  source: "bootstrap" | "changes";
  complete: boolean;
}
function observedState(input: PublicationInput) {
  const observation = readCaptureContext(input);
  const ready = observation.state === "observed" && input.complete;
  return ready
    ? {
        ready: true,
        owner: observation.binding.owner,
        ownerKey: ownerKey(observation.binding.owner),
        sessionId: observation.binding.sessionId,
        scopeRevision: observation.context.scope_revision,
        context: observation.context,
      }
    : { ready: false };
}
export function contextPublication(input: PublicationInput): readonly SqlStatement[] {
  const state = observedState(input);
  return [
    mutateCaptureAuthority({ assignmentSql: "json_extract(kv.value,'$.assignment')" }),
    {
      sql: `INSERT INTO kv(key,value) VALUES(?,json_set(json(?),'$.authorityRevision',${CURRENT_AUTHORITY_REVISION}))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      params: [
        CAPTURE_CONTEXT_KEY,
        JSON.stringify({ ...state, previousRevision: input.handle?.revision ?? null }),
      ],
    },
    {
      sql: "INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      params: [LIFECYCLE_BOOTSTRAP_PENDING, state.ready ? "false" : "true"],
    },
  ];
}
export const invalidateCaptureContext: readonly SqlStatement[] = [
  {
    sql: "INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    params: [CAPTURE_CONTEXT_KEY, '{"ready":false}'],
  },
  {
    sql: "INSERT INTO kv(key,value) VALUES(?,'true') ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    params: [LIFECYCLE_BOOTSTRAP_PENDING],
  },
];
