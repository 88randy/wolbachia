import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { unwrap } from "@wolbachia/api-client";
import type { SessionRequests } from "../../auth/session-requests.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import { ownerKey } from "../../attachments/types.ts";
import { lifecycleCommitGuards } from "./new-owned-draft.ts";
import { readAdvisory, matchesAdvisory } from "./advisory-contract.ts";
import { readRecord, CourierContractError } from "./contract-readers.ts";
import type {
  LifecycleDraft,
  LifecycleSourceTurn,
  LifecycleSourceOperation,
  CurrentLifecycleDraft,
} from "./types.ts";
export type AdvisoryView =
  | { readonly state: "available"; readonly body: Schemas["OvitrapAdvisory"] }
  | { readonly state: "unavailable"; readonly reason: string };
interface Cache {
  readonly eventId: string;
  readonly ownerKey: string;
  readonly sessionId: string;
  readonly revision: number;
  readonly body: Schemas["OvitrapAdvisory"];
  readonly isDenied?: boolean;
}
const unavailable = (reason = "advisory_not_loaded"): AdvisoryView => ({
  state: "unavailable",
  reason,
});
function cachedRecord(raw: string): Record<string, unknown> | null {
  try {
    return readRecord(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof CourierContractError) return null;
    throw error;
  }
}
function cacheMatches(
  value: Record<string, unknown>,
  draft: CurrentLifecycleDraft,
  turn: LifecycleSourceTurn,
): boolean {
  return (
    value.eventId === draft.eventId &&
    value.ownerKey === ownerKey(turn.handle.owner) &&
    value.sessionId === turn.handle.sessionId &&
    value.revision === turn.handle.revision
  );
}
function cachedBody(
  value: Record<string, unknown>,
  draft: CurrentLifecycleDraft,
  turn: LifecycleSourceTurn,
): Cache | null {
  if (value.isDenied !== undefined && typeof value.isDenied !== "boolean") return null;
  try {
    const body = readAdvisory(value.body);
    return matchesAdvisory(body, draft)
      ? {
          eventId: draft.eventId,
          ownerKey: ownerKey(turn.handle.owner),
          sessionId: turn.handle.sessionId,
          revision: turn.handle.revision,
          body,
          isDenied: value.isDenied === true,
        }
      : null;
  } catch (error) {
    if (error instanceof CourierContractError) return null;
    throw error;
  }
}
async function cached(
  db: SqlExecutor,
  draft: CurrentLifecycleDraft,
  turn: LifecycleSourceTurn,
): Promise<Cache | null> {
  const [row] = await db.query(
    "SELECT json_extract(value,'$.advisory') AS value FROM kv WHERE key='lifecycle_configuration'",
  );
  if (typeof row?.value !== "string") return null;
  const value = cachedRecord(readText(row, "value"));
  return value && cacheMatches(value, draft, turn) ? cachedBody(value, draft, turn) : null;
}
export async function readCachedAdvisory(
  db: SqlExecutor,
  draft: LifecycleDraft,
  turn: LifecycleSourceTurn | null,
): Promise<AdvisoryView> {
  if (draft.schemaVersion !== 2 || !turn) return unavailable();
  const value = await cached(db, draft, turn);
  if (!value) return unavailable();
  await turn.assertCurrent();
  if (value.isDenied) return unavailable("permission_denied");
  return value.body.state === "available"
    ? { state: "available", body: value.body }
    : unavailable(value.body.unavailable_reason ?? "advisory_not_loaded");
}
interface Dependencies {
  readonly db: SqlExecutor;
  readonly client: () => ApiClient;
  readonly requests: SessionRequests;
}
interface RequestInput {
  readonly draft: CurrentLifecycleDraft;
  readonly turn: LifecycleSourceTurn;
  readonly operation: LifecycleSourceOperation;
  readonly previous: Cache | null;
}
/** Optional explicit refresh; local capture never waits for this read or an unproven offline cutoff. */
export class LifecycleAdvisory {
  readonly #deps: Dependencies;
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  async refresh(
    draft: LifecycleDraft,
    turn: LifecycleSourceTurn,
    operation: LifecycleSourceOperation,
  ): Promise<void> {
    if (draft.kind !== "relocate" || draft.schemaVersion !== 2) return;
    const previous = await cached(this.#deps.db, draft, turn);
    const answer = await this.#request({ draft, turn, operation, previous });
    if (answer.response.status === 403) await this.#suppress({ turn, previous });
    const body =
      answer.response.status === 304 && previous ? previous.body : readAdvisory(unwrap(answer));
    if (
      answer.response.headers.get("ETag") !== `"${body.version}"` ||
      !matchesAdvisory(body, draft)
    )
      throw new CourierContractError();
    const value: Cache = {
      eventId: draft.eventId,
      ownerKey: ownerKey(turn.handle.owner),
      sessionId: turn.handle.sessionId,
      revision: turn.handle.revision,
      body,
    };
    await this.#publish(value, turn, operation);
  }
  #suppress({ turn, previous }: Pick<RequestInput, "turn" | "previous">) {
    if (!previous) return Promise.resolve();
    return turn.write(() =>
      this.#deps.db.runAtomically([
        ...lifecycleCommitGuards(turn.handle, turn.ownerFence),
        {
          sql: "UPDATE kv SET value=json_set(value,'$.advisory.isDenied',json('true')) WHERE key='lifecycle_configuration' AND json_extract(value,'$.advisory.eventId')=? AND json_extract(value,'$.advisory.ownerKey')=? AND json_extract(value,'$.advisory.sessionId')=? AND json_extract(value,'$.advisory.revision')=? AND json_extract(value,'$.advisory.body.version')=?",
          params: [
            previous.eventId,
            previous.ownerKey,
            previous.sessionId,
            previous.revision,
            previous.body.version,
          ],
        },
      ]),
    );
  }
  #request({ draft, turn, operation, previous }: RequestInput) {
    const signal = AbortSignal.timeout(30_000);
    return this.#deps.requests.run(async () => {
      await turn.assertCurrent();
      if (!operation.isCurrent() || signal.aborted)
        throw new Error("Lifecycle advisory turn changed.");
      return this.#deps.client().GET("/api/v1/field/ovitrap-advisories/{id}/", {
        params: advisoryParams(draft, previous),
        signal,
      });
    });
  }
  #publish(value: Cache, turn: LifecycleSourceTurn, operation: LifecycleSourceOperation) {
    return operation.admit(turn, () =>
      this.#deps.db.runAtomically([
        ...lifecycleCommitGuards(turn.handle, turn.ownerFence),
        {
          sql: "INSERT INTO lifecycle_guard(slot,value) VALUES(1,CASE WHEN EXISTS(SELECT 1 FROM kv WHERE key='lifecycle_configuration') THEN 1 ELSE 0 END) ON CONFLICT(slot) DO UPDATE SET value=excluded.value",
        },
        {
          sql: "UPDATE kv SET value=json_set(value,'$.advisory',json(?)) WHERE key='lifecycle_configuration'",
          params: [JSON.stringify(value)],
        },
      ]),
    );
  }
}
function advisoryParams(draft: CurrentLifecycleDraft, previous: Cache | null) {
  return {
    path: { id: draft.ovitrapId },
    query: { at: draft.deviceTime },
    ...(previous ? { header: { "If-None-Match": `"${previous.body.version}"` } } : {}),
  };
}
