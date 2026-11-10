import type { ApiClient } from "@wolbachia/api-client";
import type { versionBody } from "./permit-draft";
import type { Permit } from "./permits-query";

type Body = ReturnType<typeof versionBody>;

export interface Call {
  client: ApiClient;
  body: Body;
  signal: AbortSignal;
}

/** `POST /permits/`: the code and the quadrant are fixed forever by this first version. */
export function postPermit(call: Call, identity: { code: string; quadrant: string }) {
  return call.client.POST("/api/v1/permits/", {
    body: { ...call.body, ...identity },
    signal: call.signal,
  });
}

/** `POST /permits/{id}/versions/`: guarded by the revision the user is looking at. */
export function postPermitVersion(call: Call, permit: Permit) {
  return call.client.POST("/api/v1/permits/{id}/versions/", {
    params: { path: { id: permit.id } },
    body: { ...call.body, expected_revision: permit.revision },
    signal: call.signal,
  });
}
