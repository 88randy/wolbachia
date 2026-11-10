import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";

import { createScopedApiClient } from "../../api/create-scoped-api-client.ts";
import type { MobileApiClientOptions } from "../../api/create-api-client.ts";
import type { CredentialStore } from "../../auth/credential-store.ts";
import { RemoteSessionEnded } from "../../auth/session-requests.ts";
import type { ApiAnswer, SessionRequests } from "../../auth/session-requests.ts";
import type { TokenStore } from "../../auth/token-store.ts";
import { SYNC_REQUEST_TIMEOUT_MS } from "../../sync/sync-transport.ts";

const FIRST_PAGE = 1;
const PAGE_SIZE = 100;

interface Dependencies {
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly requests: SessionRequests;
  readonly fetch?: MobileApiClientOptions["fetch"];
}

export interface IncidentRemote {
  readonly readTypes: () => Promise<Schemas["IncidentType"][]>;
  /** Authorized first page, not an exhaustive own-author feed. */
  readonly readReported: () => Promise<Schemas["ReportedIncident"][]>;
  /** Free-form work support configuration, not a certified emergency telephone. */
  readonly readSupportContact: () => Promise<string | null>;
}

async function request<Answer extends ApiAnswer>(
  deps: Dependencies,
  call: (client: ApiClient, signal: AbortSignal) => Promise<Answer>,
): Promise<Answer> {
  const session = deps.tokens.getSnapshot();
  const client = createScopedApiClient(deps);
  const answer = await deps.requests.run(() =>
    call(client, AbortSignal.timeout(SYNC_REQUEST_TIMEOUT_MS)),
  );
  const current = deps.tokens.getSnapshot();
  if (
    current.status !== "active" ||
    current.sessionId !== session.sessionId ||
    current.origin !== session.origin
  )
    throw new RemoteSessionEnded();
  return answer;
}

async function readTypes(deps: Dependencies): Promise<Schemas["IncidentType"][]> {
  const page = unwrap(
    await request(deps, (client, signal) =>
      client.GET("/api/v1/incident-types/", {
        params: { query: { reportable: "true", page: FIRST_PAGE, page_size: PAGE_SIZE } },
        signal,
      }),
    ),
  );
  return page.results;
}

async function readReported(deps: Dependencies): Promise<Schemas["ReportedIncident"][]> {
  const page = unwrap(
    await request(deps, (client, signal) =>
      client.GET("/api/v1/incidents/", {
        params: { query: { kind: "reported", page: FIRST_PAGE, page_size: PAGE_SIZE } },
        signal,
      }),
    ),
  );
  return page.results.filter(
    (incident): incident is Schemas["ReportedIncident"] => "source_event" in incident,
  );
}

async function readSupportContact(deps: Dependencies): Promise<string | null> {
  const me = unwrap(await request(deps, (client, signal) => client.GET("/api/v1/me/", { signal })));
  return me.organization?.support_contact.trim() || null;
}

/** REST reads complement the existing outbox; they never manufacture sync projections. */
export function createIncidentRemote(deps: Dependencies): IncidentRemote {
  return {
    readTypes: () => readTypes(deps),
    readReported: () => readReported(deps),
    readSupportContact: () => readSupportContact(deps),
  };
}
