import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { createScopedApiClient } from "../../api/create-scoped-api-client.ts";
import type { MobileApiClientOptions } from "../../api/create-api-client.ts";
import type { CredentialStore } from "../../auth/credential-store.ts";
import type { TokenStore } from "../../auth/token-store.ts";
import { RemoteSessionEnded } from "../../auth/session-requests.ts";
import type { SessionRequests, ApiAnswer } from "../../auth/session-requests.ts";
import { SYNC_REQUEST_TIMEOUT_MS } from "../../sync/sync-transport.ts";
import type { TrainingRecords, TrainingSource } from "./types.ts";
import { readCertification, readEvaluation } from "./contract.ts";

const FIRST_PAGE = 1;
const PAGE_SIZE = 100;
interface Dependencies {
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly requests: SessionRequests;
  readonly fetch?: MobileApiClientOptions["fetch"];
}
async function request<Answer extends ApiAnswer>(
  deps: Dependencies,
  call: (client: ApiClient, signal: AbortSignal) => Promise<Answer>,
) {
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
async function certificates(deps: Dependencies, subject: string) {
  return unwrap(
    await request(deps, (client, signal) =>
      client.GET("/api/v1/users/{subject_id}/trainings/", {
        params: {
          path: { subject_id: subject },
          query: {
            page: FIRST_PAGE,
            page_size: PAGE_SIZE,
            proof: "false",
            ordering: "-created_at",
          },
        },
        signal,
      }),
    ),
  );
}
async function evaluations(deps: Dependencies, subject: string) {
  return unwrap(
    await request(deps, (client, signal) =>
      client.GET("/api/v1/evaluations/", {
        params: {
          query: {
            subject,
            page: FIRST_PAGE,
            page_size: PAGE_SIZE,
            include_voided: "true",
            ordering: "-created_at",
          },
        },
        signal,
      }),
    ),
  );
}
/** Current private read permissions remain independent; only the user's own minimized feedback is cached. */
export function createTrainingRemote(deps: Dependencies) {
  return async (subject: string, source: TrainingSource): Promise<TrainingRecords> => {
    const courses = source.canReadTraining ? await certificates(deps, subject) : null;
    const feedback = source.canReadEvaluations ? await evaluations(deps, subject) : null;
    return {
      certificates: (courses?.results ?? [])
        .map(readCertification)
        .filter((row) => row.subject_id === subject),
      evaluations: (feedback?.results ?? [])
        .map(readEvaluation)
        .filter((row) => row.subject_id === subject),
      hasMoreCertificates: courses?.next != null,
      hasMoreEvaluations: feedback?.next != null,
      fetchedAt: new Date().toISOString(),
    };
  };
}
