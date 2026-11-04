import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { apiError, makeMe } from "../test/fake-api";
import {
  ADMIN,
  PARAMETER_PATH,
  makeVersion,
  openParameterPage,
  requestsTo,
} from "../test/rules-fixtures";

const PARAMETER_API = "/api/v1/rule-parameters/max_distance_to_point_m/";
const VERSIONS_API = `${PARAMETER_API}versions/`;
const OTHER_USER = "9d3c8a77-1b2e-4f60-a5c1-0f7e6d5c4b3a";

const SCHEDULED = makeVersion({
  id: "11111111-0000-4000-8000-000000000003",
  status: "scheduled",
  value: 40,
  effective_date: "2026-11-10",
  effective_from: "2026-11-10T06:00:00Z",
  reason: "Ajuste de temporada",
  created_by: ADMIN.user.id,
  created_at: "2026-11-04T18:30:00Z",
});
const IN_FORCE = makeVersion({
  id: "11111111-0000-4000-8000-000000000002",
  status: "in_force",
  value: 50,
  created_by: OTHER_USER,
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
  void_reason: "Se capturó dos veces",
});
const HISTORY = [SCHEDULED, IN_FORCE, SUPERSEDED, VOIDED];

const rowOf = (name: RegExp) => screen.getByRole("row", { name });

describe("version history", () => {
  test("shows value, day, status, reason, author and when it was recorded, newest first", async () => {
    await openParameterPage({ versions: HISTORY });

    const scheduled = await screen.findByRole("row", { name: /40 metros/ });

    expect(within(scheduled).getByText("10 nov 2026")).toBeDefined();
    expect(within(scheduled).getByText("Programada")).toBeDefined();
    expect(within(scheduled).getByText("Ajuste de temporada")).toBeDefined();
    expect(within(scheduled).getByText("ana.supervisora")).toBeDefined();
    expect(within(scheduled).getByText(/4 nov 2026/)).toBeDefined();
    expect(within(rowOf(/50 metros/)).getByText("Vigente")).toBeDefined();
    expect(within(rowOf(/50 metros/)).getByText("Usuario 9d3c8a77")).toBeDefined();
    expect(within(rowOf(/60 metros/)).getByText("Anterior")).toBeDefined();
    expect(within(rowOf(/60 metros/)).getByText("Sistema")).toBeDefined();
    const values = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent);
    expect(values[0]).toContain("40 metros");
    expect(values[2]).toContain("60 metros");
  });

  test("hides voided versions until Include voided is on, then shows them struck through with reason and author", async () => {
    const user = userEvent.setup();
    await openParameterPage({ versions: HISTORY });
    await screen.findByRole("row", { name: /40 metros/ });
    expect(screen.queryByRole("row", { name: /45 metros/ })).toBeNull();

    await user.click(screen.getByRole("checkbox", { name: "Incluir anulados" }));

    const voided = await screen.findByRole("row", { name: /45 metros/ });
    expect(within(voided).getByText("Motivo: Se capturó dos veces")).toBeDefined();
    expect(within(voided).getByText("Anuló: Usuario 9d3c8a77")).toBeDefined();
    expect(within(voided).getByText("Anulado")).toBeDefined();
    expect(screen.getByText("Mostrando 1 a 4 de 4")).toBeDefined();
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

    expect(within(history as HTMLElement).queryAllByRole("textbox")).toHaveLength(0);
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

  async function startVoid(reply: Response | (() => Response)) {
    const user = userEvent.setup();
    const opened = await openParameterPage({
      versions: HISTORY,
      routes: { [VOID_ROUTE]: typeof reply === "function" ? reply : () => reply.clone() },
    });
    await user.click(
      await screen.findByRole("button", { name: "Anular la versión del 10 nov 2026" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", { name: /Motivo/ }), REASON);
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
    expect(requestsTo(api, "POST", VOID_PATH)[0]?.body).toEqual({ reason: REASON });
    expect(screen.getByText("Versión anulada. Sigue en el historial, tachada.")).toBeDefined();
    await waitFor(() => {
      expect(requestsTo(api, "GET", VERSIONS_API).length).toBeGreaterThan(1);
    });
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
  test("opens with Include voided on when the address says so", async () => {
    await openParameterPage({ versions: HISTORY, path: `${PARAMETER_PATH}?include_voided=true` });

    expect(await screen.findByRole("row", { name: /45 metros/ })).toBeDefined();
  });
});
