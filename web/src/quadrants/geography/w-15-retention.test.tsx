import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import type { RecordedRequest } from "../../test/fake-api";
import { geographyContext } from "./permissions";
import { controlledRead, currentRead, queryFor, consumeRead } from "./geography-read-test-helpers";
import type { ControlledRead, ReadKind } from "./geography-read-test-helpers";
import { makeVoidReasonItems } from "../../test/fake-api";
import {
  ALLOWED,
  openGeography,
  pageOf,
  POINT_ID,
  QUADRANT_ID,
  version,
  quadrant,
  point,
} from "./geography-test-helpers";

vi.mock("./GeographyMap", () => ({
  default: () => <div role="region" aria-label="Map engine" />,
}));

const COORDINATES_NAME = "Pol\u00edgono (longitud, latitud)";
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

async function readyEditor(client: QueryClient, reads: readonly ControlledRead[], context: string) {
  await consumeRead(client, await currentRead(reads, "record", context));
  await consumeRead(client, await currentRead(reads, "validation-points", context));
  return screen.findByRole<HTMLTextAreaElement>("textbox", { name: COORDINATES_NAME });
}

function expectRetainedEvidence() {
  expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: COORDINATES_NAME }).value).toBe(
    DRAFT,
  );
  const resolution = within(screen.getByRole("group", { name: "OV-010" }));
  expect(resolution.getByRole<HTMLSelectElement>("combobox").value).toBe("remove");
  expect(resolution.getByRole<HTMLInputElement>("textbox", { name: "Evidencia" }).value).toBe(
    EVIDENCE,
  );
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
    const reads: ControlledRead[] = [];
    let context = geographyContext(ALLOWED) + "|";
    let shouldHold = false;
    const reply = (request: RecordedRequest, kind: ReadKind) => {
      if (!shouldHold) return pageOf(kind === "record" ? [quadrant()] : [point()]);
      const read = controlledRead(request, kind, { context });
      reads.push(read);
      return read.reply;
    };
    const { api, app } = await openGeography({
      routes: {
        "GET /api/v1/quadrants/": (request) => reply(request, "record"),
        "GET /api/v1/sampling-points/": (request) => reply(request, "validation-points"),
      },
    });
    await prepareResolvedDraft();
    await userEvent.selectOptions(
      within(screen.getByRole("group", { name: "OV-010" })).getByRole("combobox"),
      "remove",
    );
    const selected = {
      ...ALLOWED,
      scope: {
        centers: { mode: "selected" as const, ids: ["center-north"] },
        quadrants: { mode: "selected" as const, ids: [QUADRANT_ID] },
      },
    };
    const changeScope = async (me: typeof ALLOWED) => {
      context = geographyContext(me) + "|";
      api.setRoute("GET /api/v1/me/", () => Response.json(me));
      await act(async () => {
        await app.queryClient.refetchQueries({ queryKey: ["me"] });
      });
    };
    shouldHold = true;
    await changeScope(selected);
    const lookup = await currentRead(reads, "record", context);
    expect(api.requests).toContain(lookup.request);
    await act(async () => {
      lookup.deliver();
      await lookup.bodyRequested;
    });
    // Me and even a delivered Response do not make the current scope's resource ready.
    expect(queryFor(app.queryClient, "record", context)?.state.status).toBe("pending");
    expect(screen.queryByRole("textbox", { name: COORDINATES_NAME })).toBeNull();
    await readyEditor(app.queryClient, reads, context);
    expectRetainedEvidence();
    // A second permitted context must also retain both polygon and retirement evidence.
    await changeScope(ALLOWED);
    await readyEditor(app.queryClient, reads, context);
    expectRetainedEvidence();
    const previousQuery = queryFor(app.queryClient, "record", context);
    if (previousQuery === undefined) throw new Error("No current lookup query to refresh.");
    let oldRefresh: Promise<void> = Promise.resolve();
    act(() => {
      oldRefresh = app.queryClient.refetchQueries({
        queryKey: previousQuery.queryKey,
        exact: true,
      });
    });
    const obsolete = await currentRead(reads, "record", context);
    const denied = {
      ...selected,
      scope: {
        ...selected.scope,
        quadrants: { mode: "selected" as const, ids: ["another-quadrant"] },
      },
    };
    await changeScope(denied);
    const deniedLookup = await currentRead(reads, "record", context);
    expect(obsolete.request.signal.aborted).toBe(true);
    expect(screen.queryByRole("textbox", { name: COORDINATES_NAME })).toBeNull();
    expect(screen.queryByDisplayValue(EVIDENCE)).toBeNull();
    await act(async () => {
      obsolete.deliver();
      obsolete.consume();
      await obsolete.reply;
      await oldRefresh;
    });
    expect(queryFor(app.queryClient, "record", context)?.state.status).toBe("pending");
    expect(screen.queryByRole("textbox", { name: COORDINATES_NAME })).toBeNull();
    expect(screen.queryByDisplayValue(EVIDENCE)).toBeNull();
    expect(api.requests.filter(({ method }) => method === "POST")).toHaveLength(0);
    await consumeRead(app.queryClient, deniedLookup);
    await screen.findByRole("heading", { name: "No encontramos esta p\u00e1gina" });
    // Restored access must wait for its own resource,then start with published geometry only.
    await changeScope(selected);
    const restoredLookup = await currentRead(reads, "record", context);
    expect(restoredLookup.request).not.toBe(lookup.request);
    expect(screen.queryByRole("textbox", { name: COORDINATES_NAME })).toBeNull();
    expect(screen.queryByDisplayValue(EVIDENCE)).toBeNull();
    const restored = await readyEditor(app.queryClient, reads, context);
    expect(restored.value).toBe(ORIGINAL);
    expect(screen.queryByDisplayValue(EVIDENCE)).toBeNull();
    expect(api.requests.filter(({ method }) => method === "POST")).toHaveLength(0);
  });
});
