import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, describe, expect, test, vi } from "vitest";
import { messages } from "@wolbachia/i18n";
import {
  openGeography,
  pageOf,
  POINT_ID,
  CREATED_AT,
  version,
  point,
} from "./geography-test-helpers";
// SKIPPED (test-stability pass 2026-11-11): these tests drive the typed-coordinates editor
// (QuadrantEditor / PolygonField), which no screen mounts any more: the map editor is the only
// editor (QuadrantScreen) and coordinates are never typed. The publication, evidence and retry
// rules they protect live on in the map editor (web/src/quadrants/editor), which has no tests
// yet. Follow-up: port each case to a map-editor test (terra-draw cannot be driven from jsdom,
// so it needs the editor model/saves layer), then delete this file.

vi.mock("./GeographyMap", () => ({
  default: ({ onVertex }: { onVertex?: (location: number[]) => void }) => (
    <div role="region" aria-label="Map engine">
      {[
        [0, 0],
        [2, 0],
        [0, 2],
      ].map((location) => (
        <button
          type="button"
          key={location.join()}
          onClick={() => {
            onVertex?.(location);
          }}
        >
          {location.join()}
        </button>
      ))}
    </div>
  ),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme");
});
describe("W22-W24 accessible alternatives", () => {
  test("opening point history returns keyboard focus to the fixed-code control", async () => {
    const current = point().current_version;
    if (!current) throw new Error("Missing point version");
    await openGeography({
      path: "/quadrants/C-07/versions?view=points",
      routes: { [`GET /api/v1/sampling-points/${POINT_ID}/versions/`]: pageOf([current]) },
    });
    const code = await screen.findByRole("button", { name: "OV-010" });
    code.focus();
    await userEvent.keyboard("{Enter}");
    const dialog = within(await screen.findByRole("dialog"));
    const close = dialog.getByRole("button", { name: "Cerrar" });
    expect(document.activeElement).toBe(close);
    await dialog.findByRole("table", { name: "Historial del punto" });
    await userEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(code);
  });

  test("history exposes immutable coordinates and authored retirement evidence", async () => {
    const historic = {
      ...version(1),
      created_by: "author-original",
      point_resolutions: [
        {
          id: "resolution-1",
          point: POINT_ID,
          point_version: "pv-retired",
          decision: "remove" as const,
          evidence: "Retired after documented inspection",
          created_by: "author-original",
          created_by_name: "Ana Autora",
          created_at: CREATED_AT,
        },
      ],
    };
    await openGeography({
      routes: {
        [`GET /api/v1/quadrants/${historic.quadrant}/versions/`]: pageOf([version(2), historic]),
      },
    });
    const history = within(await screen.findByRole("table", { name: "Historial de versiones" }));
    const summaries = history.getAllByText("Coordenadas publicadas");
    const summary = summaries[1];
    if (!summary) throw new Error("Missing historic version");
    await userEvent.click(summary);
    // The author is shown by name, never by id.
    expect(history.getByText(/Retired after documented inspection/).textContent).toContain(
      "Ana Autora",
    );
    expect(history.getByText(/Retired after documented inspection/).textContent).toContain(
      "Retirar con evidencia",
    );
  });
  test.skip.each([1280, 1440])(
    "keyboard drawing and coordinate editing share the same draft at width %i",
    async (width) => {
      Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
      window.dispatchEvent(new Event("resize"));
      await openGeography();
      const coordinates = await screen.findByRole<HTMLTextAreaElement>("textbox", {
        name: "Forma en el mapa",
      });
      await userEvent.clear(coordinates);
      const open = screen.getByRole("button", { name: "Abrir mapa" });
      open.focus();
      await userEvent.keyboard("{Enter}");
      await screen.findByRole("region", { name: "Map engine" });
      const draw = screen.getByRole("button", { name: "Agregar v\u00e9rtices con el mapa" });
      draw.focus();
      await userEvent.keyboard("{Enter}");
      for (const name of ["0,0", "2,0", "0,2"]) {
        screen.getByRole("button", { name }).focus();
        await userEvent.keyboard("{Enter}");
      }
      screen.getByRole("button", { name: "Cerrar anillo" }).focus();
      await userEvent.keyboard("{Enter}");
      expect(coordinates.value).toBe("0,0\n2,0\n0,2\n0,0");
      screen.getByRole("button", { name: "Cerrar mapa" }).focus();
      await userEvent.keyboard("{Enter}");
      expect(screen.queryByRole("region", { name: "Map engine" })).toBeNull();
      await userEvent.clear(coordinates);
      await userEvent.type(coordinates, "0,0\n4,0\n4,4\n0,4\n0,0");
      expect(screen.queryByRole("group", { name: "OV-010" })).toBeNull();
      expect(
        screen
          .getByRole("button", { name: "Publicar nueva versi\u00f3n" })
          .hasAttribute("disabled"),
      ).toBe(false);
    },
  );
  test.each([
    ["es-MX", "light"],
    ["es-MX", "dark"],
    ["en", "light"],
    ["en", "dark"],
  ] as const)(
    "record forms, history and live results have no axe violations in %s / %s",
    async (language, theme) => {
      document.documentElement.dataset["theme"] = theme;
      const { app } = await openGeography({ language });
      const copy = messages[language];
      await screen.findByRole("table", { name: copy["geography.history.title"] });
      expect(screen.getAllByRole("status").some((status) => status.textContent.includes("1"))).toBe(
        true,
      );
      expect(await axe(app.container)).toHaveNoViolations();
    },
  );
});
