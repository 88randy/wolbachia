import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { makeVoidReasonItems } from "../../test/fake-api";
import {
  ALLOWED,
  openGeography,
  pageOf,
  POINT_ID,
  QUADRANT_ID,
  version,
} from "./geography-test-helpers";

vi.mock("./GeographyMap", () => ({
  default: () => <div role="region" aria-label="Map engine" />,
}));

const DRAFT = "0,0\n2,0\n0,2\n0,0";
const ORIGINAL = "0,0\n4,0\n4,4\n0,4\n0,0";
const PUBLISH = `POST /api/v1/quadrants/${QUADRANT_ID}/versions/`;
const EVIDENCE = "Outside point inspected and explicitly approved";

async function prepareResolvedDraft() {
  const coordinates = await screen.findByRole<HTMLTextAreaElement>("textbox", {
    name: "Pol\u00edgono (longitud, latitud)",
  });
  fireEvent.change(coordinates, { target: { value: DRAFT } });
  const resolution = within(await screen.findByRole("group", { name: "OV-010" }));
  fireEvent.change(resolution.getByRole("combobox"), { target: { value: "keep" } });
  fireEvent.change(resolution.getByRole("textbox", { name: "Evidencia" }), {
    target: { value: EVIDENCE },
  });
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Publicar nueva versi\u00f3n" }).hasAttribute("disabled"),
    ).toBe(false);
  });
  return { coordinates, resolution };
}

describe("geography retirement and permitted draft retention", () => {
  test("the shared retirement dialog only records evidence until explicit publication and returns focus", async () => {
    const { api } = await openGeography({
      routes: {
        "GET /api/v1/catalogs/void-reason/items/": pageOf(makeVoidReasonItems()),
        [PUBLISH]: Response.json({ version: version(2), spacing_warnings: [] }, { status: 201 }),
      },
    });
    const { resolution } = await prepareResolvedDraft();
    const retire = resolution.getByRole("button", { name: "Registrar retiro" });
    await userEvent.click(retire);
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.selectOptions(await dialog.findByRole("combobox"), "other");
    const retirementEvidence = "Retirement confirmed after field inspection";
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: retirementEvidence } });
    await userEvent.click(dialog.getByRole("button", { name: "Usar motivo de retiro" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(retire);
    expect(api.requests.filter(({ method }) => method === "POST")).toHaveLength(0);
    expect(resolution.getByRole<HTMLSelectElement>("combobox").value).toBe("remove");
    expect(resolution.getByRole<HTMLInputElement>("textbox", { name: "Evidencia" }).value).toBe(
      retirementEvidence,
    );
    await userEvent.click(screen.getByRole("button", { name: "Publicar nueva versi\u00f3n" }));
    await screen.findByText("Cambios publicados");
    expect(api.requests.find(({ method }) => method === "POST")?.body).toMatchObject({
      expected_revision: 1,
      point_resolutions: [{ point: POINT_ID, decision: "remove", evidence: retirementEvidence }],
    });
  });

  test("a scope-only change retains permitted polygon evidence and destroys it when the record leaves scope", async () => {
    const { api, app } = await openGeography();
    await prepareResolvedDraft();
    const selected = {
      ...ALLOWED,
      scope: {
        centers: { mode: "selected" as const, ids: ["center-north"] },
        quadrants: { mode: "selected" as const, ids: [QUADRANT_ID] },
      },
    };
    api.setRoute("GET /api/v1/me/", Response.json(selected));
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    const retained = await screen.findByRole<HTMLTextAreaElement>("textbox", {
      name: "Pol\u00edgono (longitud, latitud)",
    });
    expect(retained.value).toBe(DRAFT);
    const resolution = within(await screen.findByRole("group", { name: "OV-010" }));
    expect(resolution.getByRole<HTMLInputElement>("textbox", { name: "Evidencia" }).value).toBe(
      EVIDENCE,
    );
    api.setRoute(
      "GET /api/v1/me/",
      Response.json({
        ...selected,
        scope: { ...selected.scope, quadrants: { mode: "selected", ids: ["another-quadrant"] } },
      }),
    );
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await screen.findByRole("heading", { name: "No encontramos esta p\u00e1gina" });
    expect(screen.queryByRole("textbox", { name: "Pol\u00edgono (longitud, latitud)" })).toBeNull();
    expect(screen.queryByDisplayValue(EVIDENCE)).toBeNull();
    // Restoring access starts from published geometry, proving the denied draft was cleared.
    api.setRoute("GET /api/v1/me/", Response.json(selected));
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    const restored = await screen.findByRole<HTMLTextAreaElement>("textbox", {
      name: "Pol\u00edgono (longitud, latitud)",
    });
    expect(restored.value).toBe(ORIGINAL);
    expect(screen.queryByDisplayValue(EVIDENCE)).toBeNull();
  });
});
