import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Schemas } from "@wolbachia/api-client";
import type { RecordedRequest } from "../../test/fake-api";
import { geographyContext } from "./permissions";
import {
  controlledRead,
  currentRead,
  consumeRead,
  queryFor,
} from "../../test/geography-read-test-helpers";
import type { ControlledRead, ReadKind } from "../../test/geography-read-test-helpers";
import { apiError } from "../../test/fake-api";
import {
  ALLOWED,
  openGeography,
  pageOf,
  POINT_ID,
  QUADRANT_ID,
  point,
  quadrant,
  version,
} from "./geography-test-helpers";

vi.mock("./GeographyMap", () => ({
  default: () => <div role="region" aria-label="Map engine" />,
}));
afterEach(() => {
  vi.useRealTimers();
});

const PUBLISH = `POST /api/v1/quadrants/${QUADRANT_ID}/versions/`;
const DRAFT = "0,0\n2,0\n0,2\n0,0";
function deferred() {
  let release: (reply: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function resolveExcludedPoint() {
  const coordinates = await screen.findByRole<HTMLTextAreaElement>("textbox", {
    name: "Pol\u00edgono (longitud, latitud)",
  });
  fireEvent.change(coordinates, { target: { value: DRAFT } });
  const resolution = within(screen.getByRole("group", { name: "OV-010" }));
  await userEvent.selectOptions(resolution.getByRole("combobox"), "keep");
  fireEvent.change(resolution.getByRole("textbox", { name: "Evidencia" }), {
    target: { value: "Outside point inspected and approved" },
  });
  return coordinates;
}
function publicationRequests(requests: { method: string; path: string; body: unknown }[]) {
  return requests.filter(
    ({ method, path }) =>
      method === "POST" && path === `/api/v1/quadrants/${QUADRANT_ID}/versions/`,
  );
}

describe("geography conflict and paging recovery", () => {
  test("refresh and reapply uses the latest revision without losing evidenced resolutions or publishing automatically", async () => {
    const reads: ControlledRead[] = [];
    const context = geographyContext(ALLOWED) + "|";
    let shouldHold = false;
    let recordRevision = 1;
    const reply = (request: RecordedRequest, kind: ReadKind) => {
      if (!shouldHold)
        return pageOf(
          kind === "record"
            ? [{ ...quadrant(), current_version: version(recordRevision) }]
            : [point()],
        );
      const read = controlledRead(request, kind, { context, recordRevision });
      reads.push(read);
      return read.reply;
    };
    const { api, app } = await openGeography({
      routes: {
        [PUBLISH]: apiError(409, "stale_revision"),
        "GET /api/v1/quadrants/": (request) => reply(request, "record"),
        "GET /api/v1/sampling-points/": (request) => reply(request, "validation-points"),
      },
    });
    await resolveExcludedPoint();
    await userEvent.click(screen.getByRole("button", { name: "Publicar nueva versi\u00f3n" }));
    await screen.findByRole("alert");
    recordRevision = 3;
    shouldHold = true;
    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "Actualizar revisi\u00f3n y reaplicar borrador" })
          .hasAttribute("disabled"),
      ).toBe(false);
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Actualizar revisi\u00f3n y reaplicar borrador" }),
    );
    const lookup = await currentRead(reads, "record", context);
    const validation = await currentRead(reads, "validation-points", context);
    await act(async () => {
      lookup.deliver();
      validation.deliver();
      await Promise.all([lookup.bodyRequested, validation.bodyRequested]);
    });
    expect(queryFor(app.queryClient, "record", context)?.state.fetchStatus).toBe("fetching");
    expect(queryFor(app.queryClient, "validation-points", context)?.state.fetchStatus).toBe(
      "fetching",
    );
    expect(screen.getByRole("alert").textContent).toContain("Hay una revisi");
    expect(publicationRequests(api.requests)).toHaveLength(1);
    await consumeRead(app.queryClient, lookup);
    expect(queryFor(app.queryClient, "record", context)?.state.data).toMatchObject({
      current_version: { revision: 3 },
    });
    // Reapply still waits for this explicit refresh's point projection.
    expect(queryFor(app.queryClient, "validation-points", context)?.state.fetchStatus).toBe(
      "fetching",
    );
    expect(screen.getByRole("alert").textContent).toContain("Hay una revisi");
    expect(publicationRequests(api.requests)).toHaveLength(1);
    await consumeRead(app.queryClient, validation);
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
    expect(
      screen.getByRole<HTMLTextAreaElement>("textbox", {
        name: "Pol\u00edgono (longitud, latitud)",
      }).value,
    ).toBe(DRAFT);
    const resolution = within(screen.getByRole("group", { name: "OV-010" }));
    expect(resolution.getByRole<HTMLInputElement>("textbox", { name: "Evidencia" }).value).toBe(
      "Outside point inspected and approved",
    );
    expect(publicationRequests(api.requests)).toHaveLength(1);
    shouldHold = false;
    api.setRoute(PUBLISH, () => {
      recordRevision = 4;
      return Response.json({ version: version(4), spacing_warnings: [] }, { status: 201 });
    });
    await userEvent.click(screen.getByRole("button", { name: "Publicar nueva versi\u00f3n" }));
    await screen.findByText("Cambios publicados");
    expect(
      publicationRequests(api.requests).map(
        ({ body }) => body as Schemas["QuadrantPublicationRequest"],
      ),
    ).toMatchObject([
      { expected_revision: 1 },
      {
        expected_revision: 3,
        point_resolutions: [
          { point: POINT_ID, decision: "keep", evidence: "Outside point inspected and approved" },
        ],
      },
    ]);
    expect(publicationRequests(api.requests)).toHaveLength(2);
    expect(publicationRequests(api.requests)[1]?.body).toEqual({
      expected_revision: 3,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [2, 0],
            [0, 2],
            [0, 0],
          ],
        ],
      },
      point_resolutions: [
        { point: POINT_ID, decision: "keep", evidence: "Outside point inspected and approved" },
      ],
    });
  });

  test("an unresolved point missing from the loaded projection blocks publishing until a refresh loads and resolves it", async () => {
    const missingId = "00000000-0000-4000-8000-000000000004";
    const { api } = await openGeography({
      routes: {
        [PUBLISH]: Response.json(
          {
            code: "unresolved_points",
            detail: "An active point was not resolved.",
            blocked_by: [
              { point: missingId, reason: "outside_quadrant", unblocked_by_role: "", link: "" },
            ],
          },
          { status: 409 },
        ),
      },
    });
    const coordinates = await resolveExcludedPoint();
    const publish = screen.getByRole("button", { name: "Publicar nueva versi\u00f3n" });
    await userEvent.click(publish);
    await screen.findByRole("alert");
    expect(publish.hasAttribute("disabled")).toBe(true);
    fireEvent.change(coordinates, { target: { value: DRAFT + " " } });
    expect(publish.hasAttribute("disabled")).toBe(true);
    const original = point();
    const missing = {
      ...original,
      id: missingId,
      code: "OV-011",
      current_version: original.current_version
        ? {
            ...original.current_version,
            id: "missing-version",
            point: missingId,
            location: [3.5, 3.5],
          }
        : null,
    };
    api.setRoute("GET /api/v1/sampling-points/", pageOf([original, missing]));
    const refresh = screen.getByRole("button", {
      name: "Actualizar revisi\u00f3n y reaplicar borrador",
    });
    await waitFor(() => {
      expect(refresh.hasAttribute("disabled")).toBe(false);
    });
    await userEvent.click(refresh);
    const newResolution = within(await screen.findByRole("group", { name: "OV-011" }));
    expect(publish.hasAttribute("disabled")).toBe(true);
    await userEvent.selectOptions(newResolution.getByRole("combobox"), "keep");
    fireEvent.change(newResolution.getByRole("textbox", { name: "Evidencia" }), {
      target: { value: "New point inspected after refresh" },
    });
    await waitFor(() => {
      expect(publish.hasAttribute("disabled")).toBe(false);
    });
    expect(publicationRequests(api.requests)).toHaveLength(1);
  });

  test("editing the polygon cannot bypass Retry-After and expiry only enables an explicit new attempt", async () => {
    const held = deferred();
    const { api } = await openGeography({ routes: { [PUBLISH]: () => held.promise } });
    const publish = await screen.findByRole("button", { name: "Publicar nueva versi\u00f3n" });
    await waitFor(() => {
      expect(publish.hasAttribute("disabled")).toBe(false);
    });
    await userEvent.click(publish);
    await waitFor(() => {
      expect(publicationRequests(api.requests)).toHaveLength(1);
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
    await act(async () => {
      held.release(apiError(429, "geography_in_progress", { headers: { "Retry-After": "5" } }));
      await held.promise;
    });
    expect(screen.getByRole("alert").textContent).toContain("La geograf\u00eda est\u00e1 en uso");
    const coordinates = screen.getByRole("textbox", { name: "Pol\u00edgono (longitud, latitud)" });
    fireEvent.change(coordinates, { target: { value: "0,0\n5,0\n5,5\n0,5\n0,0" } });
    expect(publish.hasAttribute("disabled")).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });
    expect(publish.hasAttribute("disabled")).toBe(true);
    expect(publicationRequests(api.requests)).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(publish.hasAttribute("disabled")).toBe(false);
    expect(publicationRequests(api.requests)).toHaveLength(1);
  });

  test("point history starts at its first page and pages independently while retaining the list row and focus", async () => {
    const current = point().current_version;
    if (!current) throw new Error("Missing point version");
    const { api, app } = await openGeography({
      path: "/quadrants/C-07/versions?view=points&page=2",
      routes: {
        "GET /api/v1/sampling-points/": pageOf([point()], { count: 30 }),
        [`GET /api/v1/sampling-points/${POINT_ID}/versions/`]: (request) => {
          const page = new URL(request.path, "https://test.invalid").searchParams.get("page");
          return pageOf([{ ...current, id: "history-" + String(page), version: Number(page) }], {
            count: 30,
          });
        },
      },
    });
    const code = await screen.findByRole("button", { name: "OV-010" });
    code.focus();
    await userEvent.keyboard("{Enter}");
    const dialog = within(await screen.findByRole("dialog"));
    await dialog.findByRole("table", { name: "Historial del punto" });
    const historyReads = () =>
      api.requests.filter(
        ({ method, path }) =>
          method === "GET" && path.startsWith(`/api/v1/sampling-points/${POINT_ID}/versions/`),
      );
    expect(
      new URL(historyReads()[0]?.path ?? "", "https://test.invalid").searchParams.get("page"),
    ).toBe("1");
    await userEvent.click(dialog.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => {
      expect(app.router.state.location.search).toMatchObject({
        view: "points",
        page: "2",
        history_page: "2",
      });
    });
    await waitFor(() => {
      expect(
        historyReads().some(
          ({ path }) => new URL(path, "https://test.invalid").searchParams.get("page") === "2",
        ),
      ).toBe(true);
    });
    expect(screen.getByRole("button", { name: "OV-010" })).toBe(code);
    await userEvent.click(dialog.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => {
      expect(app.router.state.location.search).toEqual({ view: "points", page: "2" });
    });
    expect(document.activeElement).toBe(code);
  });
});
