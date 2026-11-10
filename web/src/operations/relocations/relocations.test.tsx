import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { apiError, createFakeApi, makeMe } from "../../test/fake-api";
import type { FakeApiRoutes } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import { POINT_ID, PROPOSAL_ID, proposal, relocationReceipt } from "./relocation-fixtures";
const LIST = "GET /api/v1/relocations/";
const page = (results = [proposal()]) =>
  Response.json({ count: results.length, results, next: null, previous: null });
async function open(
  overrides: FakeApiRoutes = {},
  permissions = ["relocation.read", "relocation.decide"],
) {
  const me = makeMe({
    permissions,
    scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
  });
  const api = createFakeApi({
    "GET /api/v1/me/": Response.json(me),
    [LIST]: () => page(),
    ...overrides,
  });
  const app = await renderApp({
    path: `/operations/relocations?relocation=${PROPOSAL_ID}`,
    fetch: api.fetch,
  });
  return { api, app, me };
}
afterEach(() => {
  vi.restoreAllMocks();
});
describe("W31 relocation decisions", () => {
  test("rejects with retained point code and only announces the actual next-day task", async () => {
    const route = `POST /api/v1/relocations/${PROPOSAL_ID}/reject/`;
    const { api } = await open({
      [route]: Response.json(relocationReceipt("rejected"), { status: 201 }),
    });
    const dialog = await screen.findByRole("dialog", { name: "Decidir reubicación" });
    await within(dialog).findByText("P-160");
    expect(within(dialog).queryByText(/ND-160/)).toBeNull();
    await userEvent.type(
      await within(dialog).findByLabelText("Motivo de la decisión"),
      "Reviewed original site evidence",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Rechazar reubicación" }));
    await within(dialog).findByText(/ND-160.*2026-11-10/);
    expect(api.requests.find((request) => request.method === "POST")?.body).toEqual({
      expected_revision: 0,
      reason: "Reviewed original site evidence",
    });
    expect(within(dialog).getByText("P-160")).toBeDefined();
  });
  test("409 refreshes current evidence and retains the reason without a second POST", async () => {
    let hasConflict = false;
    const route = `POST /api/v1/relocations/${PROPOSAL_ID}/approve/`;
    const { api } = await open({
      [LIST]: () =>
        page([proposal({ new_location: hasConflict ? [-99.12, 19.42] : [-99.11, 19.41] })]),
      [route]: () => {
        hasConflict = true;
        return Response.json(
          {
            code: "geography_decision_conflict",
            detail: "Conflict",
            blocked_by: [
              { reason: "relocation_revision_conflict", permission: "relocation.decide", link: "" },
            ],
          },
          { status: 409 },
        );
      },
    });
    const dialog = await screen.findByRole("dialog", { name: "Decidir reubicación" });
    await userEvent.type(
      await within(dialog).findByLabelText("Motivo de la decisión"),
      "Retained reviewer reason",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Aprobar reubicación" }));
    await within(dialog).findByText(/La propuesta cambió/);
    await within(dialog).findByText("[-99.12,19.42]");
    expect(within(dialog).getByLabelText<HTMLTextAreaElement>("Motivo de la decisión").value).toBe(
      "Retained reviewer reason",
    );
    expect(
      within(dialog)
        .getByRole("button", { name: "Aprobar reubicación" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Actualizar evidencia y estado" }),
    );
    await waitFor(() => {
      expect(
        within(dialog)
          .getByRole("button", { name: "Aprobar reubicación" })
          .getAttribute("aria-disabled"),
      ).toBe("false");
    });
    expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  });
  test("read-only access exposes original evidence and hides decision controls", async () => {
    await open({}, ["relocation.read"]);
    const dialog = await screen.findByRole("dialog", { name: "Decidir reubicación" });
    await within(dialog).findByText("[-99.1,19.4]");
    expect(within(dialog).queryByRole("button", { name: "Aprobar reubicación" })).toBeNull();
    expect(within(dialog).queryByLabelText("Motivo de la decisión")).toBeNull();
  });
  test("unknown and foreign proposal codes share an unavailable state", async () => {
    await open({ [LIST]: page([]) });
    const dialog = await screen.findByRole("dialog", { name: "Decidir reubicación" });
    await within(dialog).findByText("No encontramos esta página");
    expect(within(dialog).queryByRole("button", { name: "Aprobar reubicación" })).toBeNull();
  });
  test("offline decisions retain the reason and send no write", async () => {
    const { api } = await open();
    const dialog = await screen.findByRole("dialog", { name: "Decidir reubicación" });
    await userEvent.type(
      await within(dialog).findByLabelText("Motivo de la decisión"),
      "Retained offline review reason",
    );
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    await within(dialog).findByText(/Sin conexión. Tu motivo se conserva/);
    const approve = within(dialog).getByRole("button", { name: "Aprobar reubicación" });
    expect(approve.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(approve);
    expect(within(dialog).getByLabelText<HTMLTextAreaElement>("Motivo de la decisión").value).toBe(
      "Retained offline review reason",
    );
    expect(api.requests.some((request) => request.method === "POST")).toBe(false);
  });
  test.each([403, 404])(
    "a scoped %s discards the private reason before access returns",
    async (status) => {
      const { api, app, me } = await open();
      let dialog = await screen.findByRole("dialog", { name: "Decidir reubicación" });
      await userEvent.type(
        await within(dialog).findByLabelText("Motivo de la decisión"),
        "Private obsolete draft",
      );
      api.setRoute(LIST, apiError(status, status === 403 ? "permission_denied" : "not_found"));
      api.setRoute(
        "GET /api/v1/me/",
        Response.json({
          ...me,
          scope: { ...me.scope, quadrants: { mode: "selected", ids: [POINT_ID] } },
        }),
      );
      await act(async () => {
        await app.queryClient.refetchQueries({ queryKey: ["me"] });
      });
      dialog = screen.getByRole("dialog", { name: "Decidir reubicación" });
      await within(dialog).findByRole("alert");
      expect(within(dialog).queryByText("[-99.1,19.4]")).toBeNull();
      expect(within(dialog).queryByLabelText("Motivo de la decisión")).toBeNull();
      api.setRoute(LIST, page());
      api.setRoute("GET /api/v1/me/", Response.json(me));
      await act(async () => {
        await app.queryClient.refetchQueries({ queryKey: ["me"] });
      });
      dialog = screen.getByRole("dialog", { name: "Decidir reubicación" });
      const restored =
        await within(dialog).findByLabelText<HTMLTextAreaElement>("Motivo de la decisión");
      expect(restored.value).toBe("");
    },
  );
});
