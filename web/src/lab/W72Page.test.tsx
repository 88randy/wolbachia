import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AnnotationExport } from "./annotation-export-query";
import { apiError, createFakeApi, makeMe } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { renderApp } from "../test/render-app";

const EXPORT_PATH = "/api/v1/lab/egg-annotation-exports/";
const EXPORT_ID = "00000000-0000-4000-8000-000000000072";

function exportRow(status: AnnotationExport["status"], id = EXPORT_ID): AnnotationExport {
  return {
    id,
    created_at: "2026-11-25T16:00:00Z",
    date_from: "2026-11-01",
    date_to: "2026-11-25",
    author: null,
    include_voided: false,
    format: "coco",
    status,
    image_count: 2,
    box_count: 5,
    point_count: 1,
    error_code: "",
    size_bytes: status === "ready" ? 1234 : null,
    sha256: "",
  };
}

function pageOf(rows: AnnotationExport[]) {
  return Response.json({ count: rows.length, next: null, previous: null, results: rows });
}

async function openExports(
  options: {
    rows?: AnnotationExport[];
    routes?: FakeApiRoutes;
    permissions?: string[];
    path?: string;
  } = {},
) {
  const api = createFakeApi({
    "GET /api/v1/me/": Response.json(
      makeMe({ permissions: options.permissions ?? ["egg_annotation.export"] }),
    ),
    [`GET ${EXPORT_PATH}`]: pageOf(options.rows ?? []),
    ...options.routes,
  });
  const app = await renderApp({
    path: options.path ?? "/lab/annotation-exports",
    fetch: api.fetch,
  });
  return { api, app };
}

function setDate(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("W72 annotation training exports", () => {
  test("validates the form without submitting, then sends the selected filters", async () => {
    const { api } = await openExports({
      routes: { [`POST ${EXPORT_PATH}`]: Response.json(exportRow("queued"), { status: 201 }) },
    });
    const submit = await screen.findByRole("button", { name: "Generar exportación" });
    await userEvent.click(submit);
    expect(await screen.findByText("Selecciona la fecha inicial y la fecha final.")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText("Fecha inicial"));
    expect(api.requests.filter((item) => item.method === "POST")).toHaveLength(0);
    setDate("Fecha inicial", "2026-11-01");
    setDate("Fecha final", "2026-11-25");
    await userEvent.click(screen.getByRole("button", { name: "YOLO" }));
    await userEvent.click(screen.getByRole("switch", { name: "Incluir anotaciones anuladas" }));
    await userEvent.click(submit);
    await screen.findByText("Exportación solicitada. Puedes revisar su estado en la tabla.");
    expect(api.requests.find((item) => item.method === "POST")?.body).toEqual({
      date_from: "2026-11-01",
      date_to: "2026-11-25",
      include_voided: true,
      format: "yolo",
    });
  });

  test("keeps downloads disabled until ready and downloads through the authorized endpoint", async () => {
    const rows = ["queued", "running", "failed", "ready"].map((status, index) =>
      exportRow(
        status as AnnotationExport["status"],
        `00000000-0000-4000-8000-00000000007${String(index)}`,
      ),
    );
    const ready = rows[3];
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:annotation-export");
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const { api } = await openExports({
      rows,
      routes: {
        [`GET ${EXPORT_PATH}${ready?.id ?? ""}/download/`]: new Response("archive", {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="aedesvision.zip"',
          },
        }),
      },
    });
    const table = await screen.findByRole("table", { name: "Exportaciones" });
    const buttons = within(table).getAllByRole("button", { name: "Descargar" });
    expect(buttons.map((button) => button.getAttribute("aria-disabled"))).toEqual([
      "true",
      "true",
      "true",
      null,
    ]);
    await userEvent.click(buttons[0] as HTMLElement);
    expect(api.requests.some((item) => item.path.endsWith("/download/"))).toBe(false);
    await userEvent.click(buttons[3] as HTMLElement);
    await waitFor(() => {
      expect(createUrl).toHaveBeenCalledTimes(1);
    });
    expect(revokeUrl).toHaveBeenCalledWith("blob:annotation-export");
    expect(api.requests.some((item) => item.path.endsWith("/download/"))).toBe(true);
  });

  test("uses the people picker for the author and retains filters after the max-image response", async () => {
    const author = "00000000-0000-4000-8000-000000000080";
    const { api } = await openExports({
      permissions: ["egg_annotation.export", "user.lookup"],
      routes: {
        "GET /api/v1/lookups/users/": Response.json({
          count: 1,
          next: null,
          previous: null,
          results: [{ id: author, display_name: "Synthetic annotator" }],
        }),
        [`POST ${EXPORT_PATH}`]: apiError(400, "validation_error", {
          fields: { date_to: [{ code: "annotation_export_too_many_images" }] },
        }),
      },
    });
    await screen.findByRole("button", { name: "Generar exportación" });
    setDate("Fecha inicial", "2026-11-01");
    setDate("Fecha final", "2026-11-25");
    await userEvent.click(screen.getByRole("combobox", { name: "Autor (opcional)" }));
    await userEvent.click(await screen.findByRole("option", { name: "Synthetic annotator" }));
    await userEvent.click(screen.getByRole("button", { name: "Generar exportación" }));
    await screen.findByText(/El conjunto supera 5,000 imágenes/);
    expect(api.requests.find((item) => item.method === "POST")?.body).toMatchObject({ author });
    expect(screen.getByLabelText<HTMLInputElement>("Fecha inicial").value).toBe("2026-11-01");
  });

  test("gates the route and laboratory card by the export permission", async () => {
    const { api } = await openExports({ permissions: [] });
    await screen.findByRole("heading", { name: /No tienes acceso/ });
    expect(api.requests.some((item) => item.path.startsWith(EXPORT_PATH))).toBe(false);
  });

  test("exposes the card with export-only permission and an accessible screen", async () => {
    const { app } = await openExports({ path: "/lab" });
    const link = await screen.findByRole("link", { name: /Exportar datos de entrenamiento/ });
    await userEvent.click(link);
    await screen.findByRole("button", { name: "Generar exportación" });
    expect((await axe(app.container)).violations).toEqual([]);
  });
});
