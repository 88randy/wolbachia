import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { apiError } from "../../test/fake-api";
import { openGeography, QUADRANT_ID, POINT_ID, version, point } from "./geography-test-helpers";
// SKIPPED (test-stability pass 2026-11-11): these tests drive the typed-coordinates editor
// (QuadrantEditor / PolygonField), which no screen mounts any more: the map editor is the only
// editor (QuadrantScreen) and coordinates are never typed. The publication, evidence and retry
// rules they protect live on in the map editor (web/src/quadrants/editor), which has no tests
// yet. Follow-up: port each case to a map-editor test (terra-draw cannot be driven from jsdom,
// so it needs the editor model/saves layer), then delete this file.
vi.mock("./GeographyMap", () => ({
  default: () => <div role="region" aria-label="Mapa interactivo" />,
}));
const PUBLISH = `POST /api/v1/quadrants/${QUADRANT_ID}/versions/`;
async function shrinkPolygon() {
  const coordinates = await screen.findByRole("textbox", { name: "Forma en el mapa" });
  fireEvent.change(coordinates, { target: { value: "0,0\n2,0\n0,2\n0,0" } });
  return coordinates;
}
describe.skip("W23 publication", () => {
  test("R2 blocks publication until every excluded point has an evidenced decision", async () => {
    const { api } = await openGeography({
      routes: {
        [PUBLISH]: Response.json({ version: version(2), spacing_warnings: [] }, { status: 201 }),
      },
    });
    await shrinkPolygon();
    const publish = screen.getByRole("button", { name: "Publicar nueva versión" });
    expect(publish.hasAttribute("disabled")).toBe(true);
    const resolution = screen.getByRole("group", { name: "OV-010" });
    await userEvent.selectOptions(within(resolution).getByRole("combobox"), "keep");
    expect(publish.hasAttribute("disabled")).toBe(true);
    fireEvent.change(within(resolution).getByRole("textbox", { name: "Evidencia" }), {
      target: { value: "Outside location explicitly approved" },
    });
    await userEvent.click(publish);
    await screen.findByText("Cambios publicados");
    expect(api.requests.find(({ method }) => method === "POST")?.body).toMatchObject({
      expected_revision: 1,
      point_resolutions: [
        { point: POINT_ID, decision: "keep", evidence: "Outside location explicitly approved" },
      ],
    });
  });
  test.each(["stale_revision", "invalid_geometry"])(
    "retains the draft and resolutions after %s",
    async (code) => {
      const { api } = await openGeography({
        routes: {
          [PUBLISH]:
            code === "stale_revision"
              ? apiError(409, code)
              : apiError(400, "validation_error", { fields: { geometry: [{ code }] } }),
        },
      });
      const coordinates = await shrinkPolygon();
      const resolution = screen.getByRole("group", { name: "OV-010" });
      await userEvent.selectOptions(within(resolution).getByRole("combobox"), "keep");
      const evidence = within(resolution).getByRole("textbox", { name: "Evidencia" });
      fireEvent.change(evidence, { target: { value: "Inspected outside point" } });
      await userEvent.click(screen.getByRole("button", { name: "Publicar nueva versión" }));
      await waitFor(() => {
        expect(api.requests.filter(({ method }) => method === "POST")).toHaveLength(1);
      });
      await screen.findByRole("alert");
      if (code === "invalid_geometry")
        expect(coordinates.getAttribute("aria-invalid")).toBe("true");
      expect((coordinates as HTMLTextAreaElement).value).toBe("0,0\n2,0\n0,2\n0,0");
      expect((evidence as HTMLInputElement).value).toBe("Inspected outside point");
    },
  );
});

test.skip("publication validation reads every point page and accepts an omitted final next link", async () => {
  const original = point();
  const inside = {
    ...original,
    current_version: original.current_version
      ? { ...original.current_version, location: [0.5, 0.5] }
      : null,
  };
  const outside = { ...original, id: "point-second-page", code: "OV-011" };
  const { api } = await openGeography({
    routes: {
      "GET /api/v1/sampling-points/": (request) => {
        const page = new URL(request.path, "https://test.invalid").searchParams.get("page");
        return Response.json(
          page === "1"
            ? { count: 2, next: "/api/v1/sampling-points/?page=2", results: [inside] }
            : { count: 2, results: [outside] },
        );
      },
    },
  });
  const coordinates = await screen.findByRole("textbox", {
    name: "Forma en el mapa",
  });
  fireEvent.change(coordinates, { target: { value: "0,0\n2,0\n0,2\n0,0" } });
  await screen.findByRole("group", { name: "OV-011" });
  expect(
    screen.getByRole("button", { name: "Publicar nueva versi\u00f3n" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    api.requests.filter(({ path }) => path.startsWith("/api/v1/sampling-points/")),
  ).toHaveLength(2);
});
