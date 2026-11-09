import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";

import { CredentialStore, EMPTY_CREDENTIALS } from "../src/auth/credential-store.ts";
import { RemoteSessionEnded, SessionRequests } from "../src/auth/session-requests.ts";
import { createIncidentRemote } from "../src/features/incidents/remote.ts";
import { deferred, loginResponse, memorySecrets } from "./support/auth-fakes.ts";

import { incidentType, reportedIncident } from "./support/incident-fixtures.ts";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

async function createSession() {
  const credentials = new CredentialStore(memorySecrets());
  await credentials.update(() => ({
    ...EMPTY_CREDENTIALS,
    origin: "https://incident-api.example.invalid",
    sessionId: randomUUID(),
    pair: { access: randomUUID(), refresh: randomUUID() },
  }));
  const requests = new SessionRequests({
    credentials,
    isOnline: () => true,
    refresh: () => Promise.reject(new Error("Unexpected refresh.")),
    endSession: () => credentials.markEnded(credentials.getSnapshot().sessionId),
  });
  return { credentials, requests };
}

void it("uses explicit reported reads, immutable type versions, current timeline and work contact through the generated client", async () => {
  const { credentials, requests } = await createSession();
  const incident = reportedIncident();
  const type = incidentType();
  const sent: Request[] = [];
  const remote = createIncidentRemote({
    tokens: credentials,
    requests,
    fetch: (request) => {
      sent.push(request);
      const path = new URL(request.url).pathname;
      if (path.endsWith("/incident-types/"))
        return Promise.resolve(
          jsonResponse({ count: 1, next: null, previous: null, results: [type] }),
        );
      if (path.endsWith("/incidents/"))
        return Promise.resolve(
          jsonResponse({ count: 1, next: null, previous: null, results: [incident] }),
        );
      if (path.endsWith("/me/")) {
        const me = loginResponse().me;
        return Promise.resolve(
          jsonResponse({ ...me, organization: { support_contact: " +525555550100 " } }),
        );
      }
      return Promise.resolve(jsonResponse(incident));
    },
  });

  assert.deepEqual(await remote.readTypes(), [type]);
  assert.deepEqual(await remote.readReported(), [incident]);
  assert.equal(await remote.readSupportContact(), "+525555550100");
  const [typeRequest, listRequest] = sent;
  assert.ok(typeRequest && listRequest);
  assert.equal(new URL(typeRequest.url).searchParams.get("reportable"), "true");
  assert.equal(new URL(listRequest.url).searchParams.get("kind"), "reported");
  assert.equal(new URL(listRequest.url).searchParams.has("owner"), false);
  assert.equal(new URL(listRequest.url).searchParams.get("page"), "1");
  assert.ok(sent.every((request) => request.credentials === "omit"));
  assert.ok(
    sent.every(
      (request) =>
        request.headers.get("Authorization") === `Bearer ${credentials.getAccessToken() ?? ""}`,
    ),
  );
});

void it("refuses late incident responses after session replacement, issuer replacement or revocation", async () => {
  for (const change of ["session", "issuer", "ended"]) {
    const { credentials, requests } = await createSession();
    const entered = deferred<undefined>();
    const reply = deferred<Response>();
    const remote = createIncidentRemote({
      tokens: credentials,
      requests,
      fetch: () => {
        entered.resolve(undefined);
        return reply.promise;
      },
    });
    const reading = remote.readReported();
    await entered.promise;
    if (change === "ended") await credentials.markEnded(credentials.getSnapshot().sessionId);
    else
      await credentials.update((current) => ({
        ...current,
        ...(change === "session"
          ? { sessionId: randomUUID() }
          : { origin: "https://replacement.example.invalid" }),
      }));
    reply.resolve(jsonResponse(reportedIncident()));

    await assert.rejects(reading, RemoteSessionEnded);
  }
});
