import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { apiError } from "../../test/fake-api";
import {
  ALLOWED,
  CLOSE_PATH,
  CLOSURE_PATH,
  openClosure,
  quadrant,
  pageOf,
  readiness,
  receipt,
  version,
} from "./closure-test-helpers";
describe("W33 authoritative closure readiness", () => {
  test("every independent blocker and required unblocker remains visible and prevents closing", async () => {
    const { api } = await openClosure({
      routes: {
        [`GET ${CLOSURE_PATH}`]: Response.json(
          readiness({
            blockers: [
              {
                reason: "removal_unrecovered",
                permission: "removal.resolve",
                id: "unrecovered-physical-1",
                link: "",
              },
              {
                reason: "removal_unconfirmed",
                permission: "field_event.sync",
                id: "physical-2",
                link: "",
              },
              { reason: "incident_quadrant_closure", permission: "incident.close", link: "" },
            ],
          }),
        ),
      },
    });
    const blockers = await screen.findByRole("region", { name: "Bloqueos pendientes" });
    expect(within(blockers).getByText("Ovitrampa no recuperada")).toBeDefined();
    expect(within(blockers).getByText("Retiro sin confirmar")).toBeDefined();
    expect(within(blockers).getByText("Incidente que bloquea el cierre")).toBeDefined();
    expect(within(blockers).getByText(/removal.resolve/)).toBeDefined();
    expect(within(blockers).getByText(/field_event.sync/)).toBeDefined();
    expect(within(blockers).getByText(/incident.close/)).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar cuadrante" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.requests.filter(({ method }) => method === "POST")).toHaveLength(0);
  });
  test("409 refreshes all evidence without replaying, and a new confirmation uses the reviewed revision", async () => {
    let revision = 1;
    let hasBlocker = false;
    let isClosed = false;
    let writes = 0;
    const { api } = await openClosure({
      routes: {
        "GET /api/v1/quadrants/": () =>
          pageOf([{ ...quadrant(), current_version: version(revision) }]),
        [`GET ${CLOSURE_PATH}`]: () =>
          Response.json(
            readiness({
              revision,
              quadrant_version_id: version(revision).id,
              is_closed: isClosed,
              can_close: !hasBlocker && !isClosed,
              closure: isClosed ? receipt() : null,
              blockers: hasBlocker
                ? [
                    {
                      reason: "relocation_pending",
                      permission: "relocation.decide",
                      id: "proposal-1",
                      link: "",
                    },
                  ]
                : [],
            }),
          ),
        [`POST ${CLOSE_PATH}`]: () => {
          writes += 1;
          if (writes === 1) {
            revision = 2;
            hasBlocker = true;
            return apiError(409, "geography_decision_conflict");
          }
          isClosed = true;
          return Response.json(receipt(), { status: 201 });
        },
      },
    });
    const close = await screen.findByRole("button", { name: "Cerrar cuadrante" });
    await waitFor(() => {
      expect(close.getAttribute("aria-disabled")).not.toBe("true");
    });
    await userEvent.click(close);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement).toBe(close);
    });
    await userEvent.click(close);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cierre" }));
    await screen.findByText("Reubicación sin decisión");
    expect(screen.getByRole("alert").textContent).toContain("La preparación cambió");
    expect(writes).toBe(1);
    hasBlocker = false;
    await userEvent.click(screen.getByRole("button", { name: "Actualizar preparación" }));
    await screen.findByText("No quedan bloqueos. Puedes revisar y confirmar el cierre.");
    const current = screen.getByRole("button", { name: "Cerrar cuadrante" });
    await waitFor(() => {
      expect(current.getAttribute("aria-disabled")).not.toBe("true");
    });
    await userEvent.click(current);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cierre" }));
    // The receipt reference is no longer printed: the confirmation says the closure was recorded.
    await screen.findByText("Cierre registrado.");
    expect(
      api.requests
        .filter(({ method, path }) => method === "POST" && path === CLOSE_PATH)
        .map(({ body }) => body),
    ).toEqual([{ expected_revision: 1 }, { expected_revision: 2 }]);
  });
  test("a scope-only revocation removes prior blocker references and never fetches inaccessible closure", async () => {
    const { api, app } = await openClosure({
      routes: {
        [`GET ${CLOSURE_PATH}`]: Response.json(
          readiness({
            blockers: [
              {
                reason: "removal_unconfirmed",
                permission: "field_event.sync",
                id: "PRIVATE-PHYSICAL-1",
                link: "",
              },
            ],
          }),
        ),
      },
    });
    await screen.findByText("Referencia: PRIVATE-PHYSICAL-1");
    api.setRoute(
      "GET /api/v1/me/",
      Response.json({
        ...ALLOWED,
        scope: { ...ALLOWED.scope, quadrants: { mode: "selected", ids: ["different-quadrant"] } },
      }),
    );
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await screen.findByRole("heading", { name: "No encontramos esta página" });
    expect(screen.queryByText(/PRIVATE-PHYSICAL-1/)).toBeNull();
    expect(
      app.queryClient
        .getQueryCache()
        .getAll()
        .some(
          (query) =>
            query.state.data !== undefined &&
            JSON.stringify(query.state.data).includes("PRIVATE-PHYSICAL-1"),
        ),
    ).toBe(false);
    expect(
      api.requests.filter(({ method, path }) => method === "GET" && path === CLOSURE_PATH),
    ).toHaveLength(1);
  });
  test("an inaccessible closure and unknown human code share the same not-found state", async () => {
    const { app } = await openClosure({
      routes: { [`GET ${CLOSURE_PATH}`]: apiError(404, "not_found") },
    });
    await screen.findByRole("heading", { name: "No encontramos esta página" });
    app.unmount();
    await openClosure({ routes: { "GET /api/v1/quadrants/": pageOf() } });
    await screen.findByRole("heading", { name: "No encontramos esta página" });
  });
});
