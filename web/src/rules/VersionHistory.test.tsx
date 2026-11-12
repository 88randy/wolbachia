import type { Query, QueryClient } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { isRecordedIdentity } from "../session/identity";
import { currentRevision, isSessionKnown } from "../session/session-revision";
import type { RecordedRequest } from "../test/fake-api";
import { apiError, makeMe, makeVoidReasonFields, makeVoidReasonItems } from "../test/fake-api";
import {
  ADMIN,
  PARAMETER_KEY,
  PARAMETER_PATH,
  makeVersion,
  openParameterPage,
  pageOf,
  requestsTo,
} from "../test/rules-fixtures";
import { openFilterPanel } from "../test/filter-bar-helpers";

const PARAMETER_API = "/api/v1/rule-parameters/max_distance_to_point_m/";
const VERSIONS_API = `${PARAMETER_API}versions/`;
const OTHER_USER = "9d3c8a77-1b2e-4f60-a5c1-0f7e6d5c4b3a";

/** One actual request, held independently from its fresh response and query publication. */
function heldReply() {
  let receive: (value: { request: RecordedRequest; revision: number }) => void = () => undefined;
  const started = new Promise<{ request: RecordedRequest; revision: number }>((resolve) => {
    receive = resolve;
  });
  let release: (response: Response) => void = () => undefined;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  let hasStarted = false;
  return {
    started,
    release,
    reply: (request: RecordedRequest) => {
      expect(hasStarted).toBe(false);
      hasStarted = true;
      receive({ request, revision: currentRevision() });
      return pending;
    },
  };
}

/** Observe the exact current query; successful publication entails consuming its response body. */
async function currentRead(queryClient: QueryClient, resource: string, revision: number) {
  const cache = queryClient.getQueryCache();
  const matches = (query: Query) =>
    query.queryKey[0] === "org" &&
    query.queryKey[1] === ADMIN.user.id &&
    query.queryKey[2] === ADMIN.organization?.slug &&
    (resource === "void-reasons"
      ? query.queryKey[3] === resource
      : query.queryKey[3] === "rule-parameters" &&
        query.queryKey[4] === resource &&
        query.queryKey[5] === PARAMETER_KEY) &&
    query.meta?.["revision"] === revision;
  const found = cache.findAll({ predicate: matches });
  expect(found.length).toBeLessThanOrEqual(1);
  const query =
    found[0] ??
    (await new Promise<Query>((resolve) => {
      const unsubscribe = cache.subscribe(() => {
        const created = cache.findAll({ predicate: matches })[0];
        if (created === undefined) return;
        unsubscribe();
        resolve(created);
      });
    }));
  const accepted = new Promise<void>((resolve, reject) => {
    let unsubscribe: () => void = () => undefined;
    const inspect = () => {
      if (query.state.status === "pending" || query.state.fetchStatus !== "idle") return;
      unsubscribe();
      if (query.state.status === "success") resolve();
      else reject(query.state.error ?? new Error("The current rule-history read failed"));
    };
    unsubscribe = cache.subscribe((event) => {
      if (event.query === query) inspect();
    });
    inspect();
  });
  return { query, accepted };
}

const SCHEDULED = makeVersion({
  id: "11111111-0000-4000-8000-000000000003",
  status: "scheduled",
  value: 40,
  effective_date: "2026-11-10",
  effective_from: "2026-11-10T06:00:00Z",
  reason: "Ajuste de temporada",
  created_by: ADMIN.user.id,
  created_by_username: ADMIN.user.username,
  created_at: "2026-11-04T18:30:00Z",
});
const IN_FORCE = makeVersion({
  id: "11111111-0000-4000-8000-000000000002",
  status: "in_force",
  value: 50,
  created_by: OTHER_USER,
  created_by_username: "luis.promotor",
  reason: "Primera revisión",
});
const SUPERSEDED = makeVersion({
  id: "11111111-0000-4000-8000-000000000001",
  status: "superseded",
  value: 60,
  effective_date: "2025-06-01",
  created_by: null,
  reason: "seed: design brief",
});
const VOIDED = makeVersion({
  id: "11111111-0000-4000-8000-000000000009",
  status: "voided",
  value: 45,
  effective_date: "2026-12-15",
  reason: "Versión capturada por error",
  voided_at: "2026-11-04T20:00:00Z",
  voided_by: OTHER_USER,
  voided_by_username: "luis.promotor",
  void_reason_code: "other",
  void_reason: "Se capturó dos veces",
});
const HISTORY = [SCHEDULED, IN_FORCE, SUPERSEDED, VOIDED];

const rowOf = (name: RegExp) => screen.getByRole("row", { name });

describe("version history", () => {
  test("shows value, day, status, reason, author and when it was recorded, newest first", async () => {
    let release: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { api } = await openParameterPage({
      routes: {
        [`GET ${VERSIONS_API}`]: async () => {
          await pending;
          return pageOf([SCHEDULED, IN_FORCE, SUPERSEDED]);
        },
      },
    });
    const history = within(await screen.findByRole("region", { name: "Historial de versiones" }));
    const historyRow = (name: RegExp) => history.getByRole("row", { name });
    await waitFor(() => {
      expect(requestsTo(api, "GET", VERSIONS_API)).toHaveLength(1);
    });
    release();
    const scheduled = await history.findByRole("row", { name: /40 metros/ });

    expect(within(scheduled).getByText("10 nov 2026")).toBeDefined();
    expect(within(scheduled).getByText("Programada")).toBeDefined();
    expect(within(scheduled).getByText("Ajuste de temporada")).toBeDefined();
    expect(within(scheduled).getByText("ana.supervisora")).toBeDefined();
    expect(within(scheduled).getByText(/4 nov 2026/)).toBeDefined();
    expect(within(historyRow(/50 metros/)).getByText("Vigente")).toBeDefined();
    expect(within(historyRow(/50 metros/)).getByText("luis.promotor")).toBeDefined();
    expect(within(historyRow(/60 metros/)).getByText("Anterior")).toBeDefined();
    expect(within(historyRow(/60 metros/)).getByText("Sistema")).toBeDefined();
    const values = history
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent);
    expect(values[0]).toContain("40 metros");
    expect(values[2]).toContain("60 metros");
  });

  test("hides voided versions until Include voided is on, then shows them struck through with reason and author", async () => {
    const user = userEvent.setup();
    const { api } = await openParameterPage({ versions: HISTORY });
    await screen.findByRole("row", { name: /40 metros/ });
    expect(screen.queryByRole("row", { name: /45 metros/ })).toBeNull();
    expect(requestsTo(api, "GET", VERSIONS_API)[0]?.path).toContain("include_voided=false");

    await openFilterPanel(user);
    await user.click(await screen.findByRole("switch", { name: "Incluir anulados" }));

    const voided = await screen.findByRole("row", { name: /45 metros/ });
    expect(within(voided).getByText("Motivo: Se capturó dos veces")).toBeDefined();
    expect(within(voided).getByText("Anuló: luis.promotor")).toBeDefined();
    expect(within(voided).getByText("Anulado")).toBeDefined();
    expect(screen.getByText("1–4 de 4")).toBeDefined();
    expect(requestsTo(api, "GET", VERSIONS_API).at(-1)?.path).toContain("include_voided=true");
  });

  test.each([
    { code: "duplicate", note: "", language: "es-MX", label: "Capturado dos veces" },
    {
      code: "duplicate",
      note: "Same date entered twice",
      language: "en",
      label: "Duplicate entry",
    },
    { code: "inactive", note: "", language: "en", label: "Inactivo" },
    { code: "retired_code", note: "", language: "es-MX", label: "retired_code" },
  ] as const)(
    "shows the catalog reason $code in $language with its note separately",
    async ({ code, note, language, label }) => {
      const items = makeVoidReasonItems().map((item) =>
        item.code === "inactive" ? { ...item, label_en: "" } : item,
      );
      await openParameterPage({
        versions: [makeVersion({ ...VOIDED, ...makeVoidReasonFields(code, note) })],
        path: `${PARAMETER_PATH}?include_voided=true`,
        language,
        routes: { "GET /api/v1/catalogs/void-reason/items/": pageOf(items) },
      });

      const row = await screen.findByRole("row", { name: /45/ });
      const prefix = language === "en" ? "Reason" : "Motivo";
      const reason = await within(row).findByText(`${prefix}: ${label}`);
      if (note !== "") {
        expect(within(row).getByText(note)).toBeDefined();
        expect(reason.textContent).not.toContain(note);
      }
    },
  );

  test("keeps the history readable with a raw reason code while the catalog loads or fails", async () => {
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const { app } = await openParameterPage({
      versions: [makeVersion({ ...VOIDED, ...makeVoidReasonFields("duplicate") })],
      path: `${PARAMETER_PATH}?include_voided=true`,
      routes: { "GET /api/v1/catalogs/void-reason/items/": () => pending },
    });

    const row = await screen.findByRole("row", { name: /45 metros/ });
    expect(within(row).getByText("Motivo: duplicate")).toBeDefined();
    release(apiError(500, "server_error"));
    await waitFor(() => {
      expect(
        app.queryClient
          .getQueryCache()
          .findAll({ predicate: (query) => query.queryKey[3] === "void-reasons" })[0]?.state.status,
      ).toBe("error");
    });
    expect(within(row).getByText("Motivo: duplicate")).toBeDefined();
    expect(within(row).getByText("Anuló: luis.promotor")).toBeDefined();
  });

  test("only a scheduled version has an enabled Void; the others say why they cannot be voided", async () => {
    const user = userEvent.setup();
    await openParameterPage({ versions: HISTORY });
    await screen.findByRole("row", { name: /40 metros/ });

    const enabled = within(rowOf(/40 metros/)).getByRole("button", {
      name: "Anular la versión del 10 nov 2026",
    });
    const blocked = within(rowOf(/50 metros/)).getByRole("button", {
      name: /Anular la versión del 1 ene 2026/,
    });

    expect(enabled.getAttribute("aria-disabled")).toBe("false");
    expect(blocked.getAttribute("aria-disabled")).toBe("true");
    expect(
      document.getElementById(blocked.getAttribute("aria-describedby") ?? "")?.textContent,
    ).toContain("ya entró en vigor");
    await user.click(blocked);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("a user who may read but not void sees no actions", async () => {
    await openParameterPage({
      versions: HISTORY,
      me: makeMe({ permissions: ["rule_parameter.read", "rule_parameter_version.read"] }),
    });
    await screen.findByRole("row", { name: /40 metros/ });

    expect(screen.queryByRole("columnheader", { name: "Acciones" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Anular/ })).toBeNull();
  });

  test("is read only: nothing in it edits a version", async () => {
    await openParameterPage({
      versions: HISTORY,
      me: makeMe({ permissions: ["rule_parameter.read", "rule_parameter_version.read"] }),
    });
    const history = (
      await screen.findByRole("heading", { name: "Historial de versiones" })
    ).closest("section");

    expect(
      within(history as HTMLElement).getByRole("searchbox", { name: "Buscar en motivos" }),
    ).toBeDefined();
    const table = within(await within(history as HTMLElement).findByRole("table"));
    expect(table.queryAllByRole("textbox")).toHaveLength(0);
    expect(table.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(table.queryAllByRole("combobox")).toHaveLength(0);
    expect(
      within(history as HTMLElement).queryAllByRole("button", {
        name: /editar|guardar|borrar|eliminar/i,
      }),
    ).toHaveLength(0);
  });

  test("an empty history says there is nothing yet", async () => {
    await openParameterPage({ versions: [] });

    expect(await screen.findByText("Aquí todavía no hay registros")).toBeDefined();
  });
});

describe("voiding a scheduled version", () => {
  const VOID_PATH = `${VERSIONS_API}${SCHEDULED.id}/void/`;
  const VOID_ROUTE = `POST ${VOID_PATH}`;
  const REASON = "Se capturó con la fecha equivocada";

  async function startVoid(
    reply: Response | ((request: RecordedRequest) => Response | Promise<Response>),
  ) {
    const user = userEvent.setup();
    const opened = await openParameterPage({
      versions: HISTORY,
      routes: { [VOID_ROUTE]: typeof reply === "function" ? reply : () => reply.clone() },
    });
    // Data publication and mounting its dependent observers are separate boundaries.
    const parameterRead = await currentRead(opened.app.queryClient, "detail", currentRevision());
    await act(async () => {
      await parameterRead.accepted;
    });
    const historyRead = await currentRead(opened.app.queryClient, "versions", currentRevision());
    const catalogRead = await currentRead(
      opened.app.queryClient,
      "void-reasons",
      currentRevision(),
    );
    await act(async () => {
      await Promise.all([historyRead.accepted, catalogRead.accepted]);
    });
    const dialogObserverMounted = new Promise<void>((resolve) => {
      const unsubscribe = opened.app.queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== "observerAdded" || event.query !== catalogRead.query) return;
        unsubscribe();
        resolve();
      });
    });
    await user.click(
      await screen.findByRole("button", { name: "Anular la versión del 10 nov 2026" }),
    );
    // Its subscribe call decides whether to refetch before this continuation can run.
    await dialogObserverMounted;
    const dialogCatalog = await currentRead(
      opened.app.queryClient,
      "void-reasons",
      currentRevision(),
    );
    await act(async () => {
      await dialogCatalog.accepted;
    });
    const select = within(screen.getByRole("dialog")).getByRole<HTMLSelectElement>("combobox");
    expect(select.disabled).toBe(false);
    await user.selectOptions(select, "other");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole<HTMLSelectElement>("combobox").value).toBe("other");
    await user.type(await within(dialog).findByRole("textbox", { name: /Detalle/ }), REASON);
    return { user, ...opened };
  }

  test("asks for a reason, sends it to the version, closes and refreshes the history", async () => {
    const { user, api } = await startVoid(Response.json({ ...SCHEDULED, status: "voided" }));
    expect(
      screen.getByRole("dialog", { name: "Anular Distancia máxima al punto (10 nov 2026)" }),
    ).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Anular" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(requestsTo(api, "POST", VOID_PATH)[0]?.body).toEqual({
      reason_code: "other",
      reason: REASON,
    });
    expect(screen.getByText("Versión anulada. Sigue en el historial, tachada.")).toBeDefined();
    await waitFor(() => {
      expect(requestsTo(api, "GET", VERSIONS_API).length).toBeGreaterThan(1);
    });
  });

  test("a catalog reason is sent without an empty note", async () => {
    const { user, api } = await startVoid(Response.json({ ...SCHEDULED, status: "voided" }));
    await user.selectOptions(within(screen.getByRole("dialog")).getByRole("combobox"), "duplicate");
    await user.click(screen.getByRole("button", { name: "Anular" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(requestsTo(api, "POST", VOID_PATH)[0]?.body).toEqual({ reason_code: "duplicate" });
  });

  test("regression: a void answered after a re-authentication is ignored, not shown as an error", async () => {
    const oldVoid = heldReply();
    const { user, api, app } = await startVoid(oldVoid.reply);
    await user.click(screen.getByRole("button", { name: "Anular" }));
    await screen.findByRole("button", { name: "Anulando…" });

    const issuedVoid = await oldVoid.started;
    const me = heldReply();
    const history = heldReply();
    const catalog = heldReply();
    api.setRoute("GET /api/v1/me/", me.reply);
    api.setRoute(`GET ${VERSIONS_API}`, history.reply);
    api.setRoute("GET /api/v1/catalogs/void-reason/items/", catalog.reply);
    // A real cross-tab announcement goes through /me/ and the session controller, not an epoch patch.
    await act(async () => {
      const otherTab = new BroadcastChannel("wolbachia.session");
      otherTab.postMessage("changed");
      otherTab.close();
      await me.started;
    });
    expect(isSessionKnown()).toBe(false);
    expect(currentRevision()).toBeGreaterThan(issuedVoid.revision);
    const currentMe = await me.started;
    await act(async () => {
      me.release(Response.json(ADMIN));
      await Promise.all([history.started, catalog.started]);
    });
    expect(isSessionKnown()).toBe(true);
    expect(isRecordedIdentity(app.queryClient, ADMIN.user.id, ADMIN.organization?.slug ?? "")).toBe(
      true,
    );
    const currentHistory = await history.started;
    const currentCatalog = await catalog.started;
    expect(currentMe.revision).toBe(currentHistory.revision);
    expect(currentMe.request.signal.aborted).toBe(false);
    expect(app.queryClient.getQueryData(["me"])).toEqual(ADMIN);
    expect(currentHistory.revision).toBe(currentRevision());
    expect(currentCatalog.revision).toBe(currentHistory.revision);
    expect(currentHistory.request.signal.aborted).toBe(false);
    expect(currentCatalog.request.signal.aborted).toBe(false);
    const historyRead = await currentRead(app.queryClient, "versions", currentHistory.revision);
    const catalogRead = await currentRead(app.queryClient, "void-reasons", currentCatalog.revision);
    expect(historyRead.query.state.status).toBe("pending");
    expect(catalogRead.query.state.status).toBe("pending");
    await act(async () => {
      history.release(pageOf(HISTORY.filter((version) => version.status !== "voided")));
      await historyRead.accepted;
    });
    expect(historyRead.query.state.status).toBe("success");
    expect(await screen.findByRole("row", { name: /40 metros/ })).toBeDefined();
    expect(requestsTo(api, "GET", VERSIONS_API)).toHaveLength(2);
    expect(issuedVoid.request.signal.aborted).toBe(false);
    act(() => {
      oldVoid.release(Response.json({ ...SCHEDULED, status: "voided" }, { status: 201 }));
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Anulando…" })).toBeNull();
    });
    // Write completion is not catalog readiness: its actual current response is still held.
    expect(catalogRead.query.state.status).toBe("pending");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Anular" }).disabled).toBe(true);
    await act(async () => {
      catalog.release(pageOf(makeVoidReasonItems()));
      await catalogRead.accepted;
    });
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole<HTMLSelectElement>("combobox").value).toBe("other");
    expect(
      within(dialog).getByRole<HTMLTextAreaElement>("textbox", { name: /Detalle/ }).value,
    ).toBe(REASON);
    expect(within(dialog).getByRole<HTMLButtonElement>("button", { name: "Anular" }).disabled).toBe(
      false,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Versión anulada. Sigue en el historial, tachada.")).toBeNull();
    // The initial load plus the restart the revision change caused; the stale void answer adds none.
    expect(requestsTo(api, "GET", VERSIONS_API)).toHaveLength(2);
    expect(historyRead.query.state.isInvalidated).toBe(false);
    expect(historyRead.query.state.fetchStatus).toBe("idle");
    expect(requestsTo(api, "POST", VOID_PATH).map((request) => request.body)).toEqual([
      { reason_code: "other", reason: REASON },
    ]);
  });

  test("a version that took effect meanwhile is answered in the dialog and the history is refreshed", async () => {
    const { user, api } = await startVoid(apiError(409, "version_not_scheduled"));

    await user.click(screen.getByRole("button", { name: "Anular" }));

    expect(await screen.findByText(/ya no se puede anular/)).toBeDefined();
    expect(screen.getByRole("dialog")).toBeDefined();
    await waitFor(() => {
      expect(requestsTo(api, "GET", VERSIONS_API).length).toBeGreaterThan(1);
    });
  });
});

describe("history in the address", () => {
  test("reason search, status and numeric value sorting are sent to this parameter's history", async () => {
    const { api } = await openParameterPage({
      versions: [SCHEDULED],
      path: `${PARAMETER_PATH}?search=temporada&status=scheduled&ordering=-value&include_voided=true`,
    });
    const history = within(await screen.findByRole("region", { name: "Historial de versiones" }));
    await history.findByRole("row", { name: /40 metros/ });
    const query = new URL(requestsTo(api, "GET", VERSIONS_API)[0]?.path ?? "", "http://api.invalid")
      .searchParams;
    expect(Object.fromEntries(query)).toEqual({
      page: "1",
      page_size: "100",
      include_voided: "true",
      search: "temporada",
      status: "scheduled",
      ordering: "-value",
    });
    expect(history.getByRole("columnheader", { name: /Valor/ }).getAttribute("aria-sort")).toBe(
      "descending",
    );
  });
  test("opens with Include voided on when the address says so", async () => {
    await openParameterPage({ versions: HISTORY, path: `${PARAMETER_PATH}?include_voided=true` });

    expect(await screen.findByRole("row", { name: /45 metros/ })).toBeDefined();
  });
});
