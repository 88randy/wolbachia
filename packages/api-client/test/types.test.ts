// Compile-time checks, enforced by `tsc --noEmit` (npm run typecheck at the repo root): the
// generated types must flow through the client. The runtime test only proves the file loads.
import assert from "node:assert/strict";
import { it } from "node:test";

import type { ErrorEnvelope, Schemas } from "../src/index.ts";
import { unwrap } from "../src/index.ts";
import { clientWith, recordingFetch } from "./helpers.ts";

// Mutual assignability: enough here (no `any` in these types) and lint-clean.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

async function typedCalls() {
  const { fetch } = recordingFetch();
  const client = clientWith({ fetch });

  const me = await client.GET("/api/v1/me/");
  const health = await client.GET("/api/v1/health/");
  const data = unwrap(me);

  // Personnel writes accept omitted work contact, including a minimal CAS patch.
  await client.POST("/api/v1/users/", {
    body: {
      username: "synthetic-employee",
      display_name: "Synthetic employee",
      center_id: "synthetic-center-id",
    },
  });
  await client.PATCH("/api/v1/users/{id}/", {
    params: { path: { id: "synthetic-user-id" } },
    body: { expected_revision: 1, display_name: "Synthetic renamed employee" },
  });

  // @ts-expect-error unknown path
  await client.GET("/api/v1/nope/");
  // @ts-expect-error /me/ has no POST
  await client.POST("/api/v1/me/");
  // @ts-expect-error the header param must be a string
  await client.GET("/api/v1/me/", { params: { header: { "X-Organization": 1 } } });

  return { me, health, data };
}

type Calls = Awaited<ReturnType<typeof typedCalls>>;

export type Checks = [
  // Success data comes from the 200 response schema.
  Expect<Equal<Calls["data"], Schemas["Me"]>>,
  Expect<Equal<Calls["me"]["data"], Schemas["Me"] | undefined>>,
  Expect<Equal<Calls["health"]["data"], Schemas["Health"] | undefined>>,
  // Every non-2xx response is typed from the `default` response: the error envelope.
  Expect<Equal<Calls["me"]["error"], ErrorEnvelope | undefined>>,
  Expect<Equal<Calls["health"]["error"], ErrorEnvelope | undefined>>,
  // The envelope has the documented fields.
  Expect<Equal<ErrorEnvelope["code"], string>>,
  Expect<Equal<ErrorEnvelope["detail"], string>>,
  Expect<Equal<keyof ErrorEnvelope, "code" | "detail" | "fields" | "blocked_by">>,
];

void it("is checked by tsc, not at runtime", () => {
  assert.equal(typeof typedCalls, "function");
});
