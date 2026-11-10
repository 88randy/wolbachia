import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Schemas } from "@wolbachia/api-client";
import { createFakeApi, makeMe, apiError } from "../../test/fake-api";
import type { FakeApiRoutes } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import { invalidateOrgScoped } from "../../session/org-scoped-query";

const ID = "00000000-0000-4000-8000-000000000160";
const LIST = "GET /api/v1/review-items/";
const DETAIL = `GET /api/v1/review-items/${ID}/`;
const ACCEPT = `POST /api/v1/review-items/${ID}/accept/`;
const permissions = ["review_item.read", "review_item.decide", "incident.create"];
function review(overrides: Partial<Schemas["ReviewItemDetail"]> = {}): Schemas["ReviewItemDetail"] {
  return {
    id: ID,
    event_id: ID,
    event_type: "release.capture",
    kind: "rejected",
    code: "permit_expired",
    params: {},
    courier: ID,
    device: ID,
    created_at: "2026-11-01T12:00:00Z",
    ingest_status: "rejected",
    decision_state: {
      revision: 0,
      kind: "pending",
      latest_kind: null,
      audit_only: false,
      terminal: false,
    },
    evaluation: {
      can_accept: false,
      blockers: ["permit_expired"],
      legacy_state: "none",
      subjects: [],
      scope_resolved: true,
      authority_proof_ids: [],
    },
    original_event: {
      envelope: { id: ID },
      payload: { point_code: "P-160" },
      server_received_at: "2026-11-01T12:00:00Z",
      clock_skew_seconds: 0,
      voided_at: null,
      provenance: {
        snapshot_id: null,
        policy_version: null,
        point_version_id: null,
        rule_version_ids: {},
        rule_values: {},
        fuel_baseline_id: null,
        fuel_context_available: null,
      },
    },
    timeline: [],
    ...overrides,
  };
}
async function open(
  routes: FakeApiRoutes = {},
  me = makeMe({
    permissions,
    scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
  }),
) {
  const api = createFakeApi({
    "GET /api/v1/me/": Response.json(me),
    [LIST]: Response.json({ count: 1, next: null, previous: null, results: [review()] }),
    [DETAIL]: Response.json(review()),
    ...routes,
  });
  const app = await renderApp({ path: `/operations/reviews?item=${ID}`, fetch: api.fetch });
  return { api, app };
}

test("a rejected release retains original evidence and never offers acceptance past its safety blocker", async () => {
  const { api } = await open();
  await screen.findByRole("heading", { name: "Registro original y decisiones" });
  await userEvent.type(
    await screen.findByLabelText("Motivo de la decisión"),
    "Review original evidence",
  );
  expect(screen.getByRole("button", { name: "Aceptar" }).hasAttribute("disabled")).toBe(true);
  await userEvent.click(screen.getByText("Captura, evidencia y procedencia originales"));
  expect(screen.getByText(/P-160/)).toBeDefined();
  expect(screen.getByText(/permit_expired/, { selector: "li" })).toBeDefined();
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(0);
});

test("409 retains reason, refreshes original and current evidence, and requires a deliberate new revision", async () => {
  const initial = review({
    evaluation: { ...review().evaluation, can_accept: true, blockers: [] },
  });
  const { api } = await open({
    [DETAIL]: Response.json(initial),
    [ACCEPT]: apiError(409, "review_revision_conflict"),
  });
  const input = await screen.findByLabelText("Motivo de la decisión");
  await userEvent.type(input, "Review original evidence");
  await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));
  await userEvent.click(screen.getAllByRole("button", { name: "Aceptar" }).at(-1) as HTMLElement);
  await screen.findByText("review_revision_conflict");
  expect((input as HTMLInputElement).value).toBe("Review original evidence");
  const current = { ...initial, decision_state: { ...initial.decision_state, revision: 2 } };
  api.setRoute(DETAIL, Response.json(current));
  await userEvent.click(screen.getByRole("button", { name: "Actualizar evidencia vigente" }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Aceptar" }).hasAttribute("disabled")).toBe(false);
  });
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));
  await userEvent.click(screen.getAllByRole("button", { name: "Aceptar" }).at(-1) as HTMLElement);
  await waitFor(() => {
    expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(2);
  });
  expect(api.requests.filter((request) => request.method === "POST").at(-1)?.body).toEqual({
    reason: "Review original evidence",
    expected_revision: 2,
  });
});

test("scope loss removes old results and prevents an inaccessible deep link from reading or deciding", async () => {
  const { api, app } = await open();
  await screen.findByLabelText("Motivo de la decisión");
  const count = api.requests.filter((request) => request.path.includes("review-items")).length;
  api.setRoute(
    "GET /api/v1/me/",
    Response.json(
      makeMe({
        permissions,
        scope: {
          centers: { mode: "selected", ids: [] },
          quadrants: { mode: "all", ids: [] },
        },
      }),
    ),
  );
  await act(async () => {
    await app.queryClient.invalidateQueries({ queryKey: ["me"] });
  });
  await screen.findByText(/Esta vista requiere permiso/);
  expect(screen.queryByLabelText("Motivo de la decisión")).toBeNull();
  expect(api.requests.filter((request) => request.path.includes("review-items"))).toHaveLength(
    count,
  );
  await act(async () => {
    await invalidateOrgScoped(app.queryClient, "reviews");
  });
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(0);
});

test("forbidden decisions are hidden and unknown or foreign reviews show the same unavailable state", async () => {
  await open(
    { [DETAIL]: apiError(404, "not_found") },
    makeMe({
      permissions: ["review_item.read"],
      scope: {
        centers: { mode: "all", ids: [] },
        quadrants: { mode: "all", ids: [] },
      },
    }),
  );
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("Motivo de la decisión")).toBeNull();
  expect(screen.queryByRole("button", { name: "Aceptar" })).toBeNull();
});

test("a definitive list denial hides previously accepted rows during refresh", async () => {
  const { api, app } = await open();
  await screen.findByRole("link", { name: `Revisar evento ${ID}` });
  api.setRoute(LIST, apiError(403, "permission_denied"));
  await act(async () => {
    await invalidateOrgScoped(app.queryClient, "reviews");
  });
  await screen.findByRole("alert");
  expect(screen.queryByRole("link", { name: `Revisar evento ${ID}` })).toBeNull();
});

test.each([503, 403, 404])(
  "a confirmed receipt survives transient failure but retires on access denial: %s",
  async (status) => {
    const initial = review({
      evaluation: { ...review().evaluation, can_accept: true, blockers: [] },
    });
    const receipt: Schemas["ReviewDecision"] = {
      id: ID,
      review_item: ID,
      revision: 1,
      expected_revision: 0,
      is_terminal: true,
      decision_state: "accepted",
      audit_only: false,
      kind: "accept",
      reason: "Confirmed reason retained",
      evidence_ids: [],
      evaluation: initial.evaluation,
      created_by: ID,
      created_at: initial.created_at,
      safety_disposition: null,
      incident_id: null,
      effect_receipt: {
        id: ID,
        source_event: ID,
        decision: ID,
        mode: "applied_review",
        payload_sha256: "test-hash",
        handler_version: "test-v1",
        materialization: { point_code: "P-160" },
        authority_proofs: [],
        observations: {},
        created_by: ID,
        created_at: initial.created_at,
      },
    };
    const { api } = await open({ [DETAIL]: Response.json(initial) });
    api.setRoute(ACCEPT, () => {
      api.setRoute(DETAIL, apiError(status, "unavailable"));
      return Response.json(receipt, { status: 201 });
    });
    await userEvent.type(await screen.findByLabelText("Motivo de la decisión"), receipt.reason);
    await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Aceptar" }).at(-1) as HTMLElement);
    await screen.findByRole("alert");
    if (status === 503) {
      expect(screen.getByText(receipt.reason)).toBeDefined();
      await userEvent.click(screen.getByText("Recibo del efecto confirmado"));
      expect(screen.getByText(/test-hash/)).toBeDefined();
    } else {
      expect(screen.queryByText(receipt.reason)).toBeNull();
      expect(screen.queryByText("Recibo del efecto confirmado")).toBeNull();
      expect(screen.queryByLabelText("Motivo de la decisión")).toBeNull();
    }
    expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  },
);

test("a nonempty scope change purges a denied private reason and old cached evidence", async () => {
  const { api, app } = await open({
    [LIST]: () => Response.json({ count: 1, next: null, previous: null, results: [review()] }),
  });
  await userEvent.type(
    await screen.findByLabelText("Motivo de la decisión"),
    "Private original reason",
  );
  api.setRoute(DETAIL, apiError(404, "not_found"));
  api.setRoute(
    "GET /api/v1/me/",
    Response.json(
      makeMe({
        permissions,
        scope: {
          centers: { mode: "selected", ids: ["other-center"] },
          quadrants: { mode: "all", ids: [] },
        },
      }),
    ),
  );
  await act(async () => {
    await app.queryClient.invalidateQueries({ queryKey: ["me"] });
  });
  await waitFor(() => {
    const record = within(screen.getByRole("region", { name: "Registro original y decisiones" }));
    expect(record.getByRole("alert")).toBeDefined();
  });
  expect(screen.queryByLabelText("Motivo de la decisión")).toBeNull();
  api.setRoute(DETAIL, Response.json(review()));
  const currentRecord = within(
    screen.getByRole("region", { name: "Registro original y decisiones" }),
  );
  await userEvent.click(
    currentRecord.getByRole("button", { name: "Actualizar evidencia vigente" }),
  );
  const input = await screen.findByLabelText<HTMLInputElement>("Motivo de la decisión");
  expect(input.value).toBe("");
});
