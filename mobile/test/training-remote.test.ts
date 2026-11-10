import assert from "node:assert/strict";
import { test } from "node:test";
import { createTrainingRemote } from "../src/features/training/remote.ts";
import { SessionRequests, RemoteSessionEnded } from "../src/auth/session-requests.ts";
import type { TrainingSource } from "../src/features/training/types.ts";
import { makeCredentials, deferred } from "./support/auth-fakes.ts";
import { trainingCertificate, trainingEvaluation } from "./training-fixtures.ts";

const SOURCE: TrainingSource = {
  eligibility: [],
  records: null,
  canReadTraining: true,
  canReadEvaluations: true,
  guard: { sql: "SELECT 1" },
};
function page(results: unknown[], next: string | null = null) {
  return new Response(JSON.stringify({ count: results.length, results, next, previous: null }), {
    headers: { "Content-Type": "application/json" },
  });
}
void test("P30 generated-client reads remain self-only and proof-free; replacement sessions cannot inherit a response", async () => {
  const { credentials } = await makeCredentials();
  const requests = new SessionRequests({
    credentials,
    isOnline: () => true,
    refresh: (pair) => Promise.resolve(pair),
    endSession: () => Promise.resolve(),
  });
  const sent: URL[] = [];
  const remote = createTrainingRemote({
    tokens: credentials,
    requests,
    fetch: (request) => {
      const url = new URL(request.url);
      sent.push(url);
      return Promise.resolve(
        url.pathname.endsWith("/trainings/")
          ? page([trainingCertificate()], "/next")
          : page([trainingEvaluation()]),
      );
    },
  });
  const subject = trainingCertificate().subject_id;
  const result = await remote(subject, SOURCE);
  assert.equal(sent[0]?.pathname, `/api/v1/users/${subject}/trainings/`);
  assert.equal(sent[0].searchParams.get("proof"), "false");
  assert.equal(sent[1]?.searchParams.get("subject"), subject);
  assert.equal(sent[1].searchParams.get("include_voided"), "true");
  assert.equal(result.hasMoreCertificates, true);
  assert.equal(JSON.stringify(result).includes("section_scores"), false);
  const response = deferred<Response>(),
    started = deferred<undefined>();
  const stale = createTrainingRemote({
    tokens: credentials,
    requests,
    fetch: () => {
      started.resolve(undefined);
      return response.promise;
    },
  });
  const pending = stale(subject, SOURCE);
  await started.promise;
  await credentials.update((current) => ({ ...current, sessionId: "replacement-session" }));
  response.resolve(page([trainingCertificate()]));
  await assert.rejects(pending, RemoteSessionEnded);
});
