import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AnnotationExport } from "./annotation-export-query";
import { createFakeApi, makeMe } from "../test/fake-api";
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

  test("uses a cookie-authenticated direct download link without buffering the ZIP", async () => {
    const rows = ["queued", "running", "failed", "ready"].map((status, index) =>
      exportRow(
        status as AnnotationExport["status"],
        `00000000-0000-4000-8000-00000000007${String(index)}`,
      ),
    );
    const createUrl = vi.spyOn(URL, "createObjectURL");
    const { api } = await openExports({ rows });
    const table = await screen.findByRole("table", { name: "Exportaciones" });
    expect(within(table).getAllByRole("button", { name: "Descargar" })).toHaveLength(3);
    const link = within(table).getByRole("link", { name: "Descargar" });
    expect(link.getAttribute("href")).toBe(`${EXPORT_PATH}${rows[3]?.id ?? ""}/download/`);
    expect(link.hasAttribute("download")).toBe(true);
    expect(createUrl).not.toHaveBeenCalled();
    expect(api.requests.some((item) => item.path.endsWith("/download/"))).toBe(false);
  });

  test("regenerates an expired archive with the same filters", async () => {
    const expired = { ...exportRow("expired"), format: "yolo" as const, include_voided: true };
    const { api } = await openExports({
      rows: [expired],
      routes: { [`POST ${EXPORT_PATH}`]: Response.json(exportRow("queued"), { status: 201 }) },
    });
    await screen.findByText("Expirada");
    await userEvent.click(screen.getByRole("button", { name: "Volver a generar" }));
    await waitFor(() => {
      expect(api.requests.some((item) => item.method === "POST")).toBe(true);
    });
    expect(api.requests.find((item) => item.method === "POST")?.body).toEqual({
      date_from: expired.date_from,
      date_to: expired.date_to,
      author: expired.author,
      include_voided: true,
      format: "yolo",
    });
  });

  test.each([
    ["2026-11-25", "", "Selecciona la fecha inicial y la fecha final."],
    ["2026-11-25", "2026-11-24", "La fecha final debe ser igual o posterior a la inicial."],
    ["2024-01-01", "2025-01-01", "Selecciona un periodo de hasta 366 días, incluidos ambos días."],
  ])("places the date error on the final field for %s through %s", async (from, to, message) => {
    await openExports();
    await screen.findByRole("button", { name: "Generar exportación" });
    setDate("Fecha inicial", from);
    setDate("Fecha final", to);
    await userEvent.click(screen.getByRole("button", { name: "Generar exportación" }));
    expect(await screen.findByText(message)).toBeDefined();
    const culprit = screen.getByLabelText("Fecha final");
    expect(culprit.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Fecha inicial").getAttribute("aria-invalid")).toBe(null);
    expect(document.activeElement).toBe(culprit);
  });

  test("shows photo and disclosure notices before a request and invalidates only export history", async () => {
    const { app, api } = await openExports({
      routes: { [`POST ${EXPORT_PATH}`]: Response.json(exportRow("queued"), { status: 201 }) },
    });
    await screen.findByText(/Las fotos pueden mostrar códigos o etiquetas escritos a mano/);
    expect(
      screen.getByText(
        "Generar la exportación revela los conteos incluidos: no podrás hacer reconteos ciegos de esas bolsas.",
      ),
    ).toBeDefined();
    expect(api.requests.some((item) => item.method === "POST")).toBe(false);
    const identity = makeMe();
    const prefix = ["org", identity.user.id, identity.organization?.slug ?? "", "lab"];
    const queueKey = [...prefix, "queue"];
    const exportKey = [...prefix, "annotation-exports", 7];
    app.queryClient.setQueryData(queueKey, { untouched: true });
    app.queryClient.setQueryData(exportKey, { results: [] });
    setDate("Fecha inicial", "2026-11-01");
    setDate("Fecha final", "2026-11-25");
    await userEvent.click(screen.getByRole("button", { name: "Generar exportación" }));
    await screen.findByText("Exportación solicitada. Puedes revisar su estado en la tabla.");
    expect(app.queryClient.getQueryState(queueKey)?.isInvalidated).toBe(false);
    expect(app.queryClient.getQueryState(exportKey)?.isInvalidated).toBe(true);
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
        [`POST ${EXPORT_PATH}`]: Response.json(
          {
            code: "validation_error",
            detail: "Synthetic image cap.",
            fields: {
              date_to: [{ code: "annotation_export_too_many_images", params: { max_images: 123 } }],
            },
          },
          { status: 400 },
        ),
      },
    });
    await screen.findByRole("button", { name: "Generar exportación" });
    setDate("Fecha inicial", "2026-11-01");
    setDate("Fecha final", "2026-11-25");
    await userEvent.click(screen.getByRole("combobox", { name: "Autor (opcional)" }));
    await userEvent.click(await screen.findByRole("option", { name: "Synthetic annotator" }));
    await userEvent.click(screen.getByRole("button", { name: "Generar exportación" }));
    await screen.findByText(/El conjunto supera 123 imágenes/);
    expect(screen.getByLabelText("Fecha final").getAttribute("aria-invalid")).toBe("true");
    expect(api.requests.find((item) => item.method === "POST")?.body).toMatchObject({ author });
    expect(screen.getByLabelText<HTMLInputElement>("Fecha inicial").value).toBe("2026-11-01");
  });

  test("shows the retained author filter with a resolved name and no raw identifier", async () => {
    const author = "00000000-0000-4000-8000-000000000080";
    await openExports({
      rows: [{ ...exportRow("ready"), author }],
      permissions: ["egg_annotation.export", "user.lookup"],
      routes: {
        [`GET /api/v1/lookups/users/${author}/`]: Response.json({
          id: author,
          display_name: "Synthetic annotator",
        }),
      },
    });
    const table = await screen.findByRole("table", { name: "Exportaciones" });
    expect(await within(table).findByText("Synthetic annotator")).toBeDefined();
    expect(within(table).getByText("Autor (opcional):")).toBeDefined();
    expect(within(table).queryByText(author)).toBe(null);
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
