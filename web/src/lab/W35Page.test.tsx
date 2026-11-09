import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { beforeEach, describe, expect, test } from "vitest";
import { apiError, makeVoidReasonItems } from "../test/fake-api";
import { BAG, COUNT, candidate, count, openCount, outcome, pageOf } from "./count-test-helpers";

beforeEach(() => { window.sessionStorage.clear(); });

describe("W35 keyboard counting", () => {
  test("waits for confirmation, prevents duplicate Enter and advances with focus on the next count", async () => {
    let release!: (answer: Response) => void;
    const held = new Promise<Response>((resolve) => { release = resolve; });
    const { api } = await openCount({ routes: { [`POST /api/v1/bags/${BAG}/counts/`]: () => held } });
    const input = await screen.findByRole("textbox", { name: "Huevos de laboratorio" });
    await waitFor(() => { expect(document.activeElement).toBe(input); });
    await userEvent.type(input, "12{Enter}{Enter}");
    await waitFor(() => { expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1); });
    expect((input as HTMLInputElement).value).toBe("12");
    release(outcome({ ...candidate("B-032"), id: "bag-32" }));
    await screen.findByRole("heading", { name: "B-032" });
    await waitFor(() => { expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Huevos de laboratorio" })); });
  });

  test("rejects invalid input inline without sending a count", async () => {
    const value = "1.5";
    const { api } = await openCount();
    const input = await screen.findByRole("textbox", { name: "Huevos de laboratorio" });
    fireEvent.change(input, { target: { value } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByText("Escribe un entero de cero o más, sin decimales.")).toBeDefined();
    expect(document.activeElement).toBe(input);
    expect(api.requests.some((request) => request.method === "POST")).toBe(false);
  });

  test("keeps zero and retries a lost reply with the same command UUID and payload", async () => {
    let attempts = 0;
    const { api } = await openCount({ routes: { [`POST /api/v1/bags/${BAG}/counts/`]: () => {
      if (++attempts === 1) throw new TypeError("Lost reply");
      return outcome();
    } } });
    await userEvent.type(await screen.findByRole("textbox", { name: "Huevos de laboratorio" }), "0{Enter}");
    await screen.findByText(/No se confirmó el guardado/);
    expect((screen.getByRole("textbox", { name: "Huevos de laboratorio" }) as HTMLInputElement).value).toBe("0");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar guardado" }));
    await screen.findByText("Conteo guardado.");
    const posts = api.requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[0]?.body).toEqual(posts[1]?.body);
    expect(posts[0]?.body).toMatchObject({ value: 0, expected_revision: 0, confirmed_implausible: false });
  });

  test("requires explicit confirmation from the server plausibility gate", async () => {
    const { api } = await openCount({ routes: { [`POST /api/v1/bags/${BAG}/counts/`]: ({ body }) =>
      (body as { confirmed_implausible: boolean }).confirmed_implausible ? outcome() : apiError(409, "lab_confirmation_required") } });
    await userEvent.type(await screen.findByRole("textbox", { name: "Huevos de laboratorio" }), "1200{Enter}");
    await userEvent.click(await screen.findByRole("button", { name: "Confirmar conteo alto" }));
    await screen.findByText("Conteo guardado.");
    const posts = api.requests.filter((request) => request.method === "POST");
    expect(posts[1]?.body).toMatchObject({ value: 1200, confirmed_implausible: true });
    expect(posts[0]?.body).not.toEqual(posts[1]?.body);
  });

  test("retains a conflicting draft and shows the authorized existing counter and time", async () => {
    await openCount({ routes: { [`POST /api/v1/bags/${BAG}/counts/`]: apiError(409, "lab_state_conflict") } });
    await userEvent.type(await screen.findByRole("textbox", { name: "Huevos de laboratorio" }), "12{Enter}");
    await screen.findByText(/Otra captura cambió esta bolsa/);
    expect(await screen.findByText("counter-31")).toBeDefined();
    expect(document.querySelector('time[datetime="2026-11-03T15:00:00Z"]')).not.toBeNull();
    expect((screen.getByRole("textbox", { name: "Huevos de laboratorio" }) as HTMLInputElement).value).toBe("12");
  });

  test("hides capture without permission and sends no laboratory request", async () => {
    const { api } = await openCount({ permissions: [] });
    await screen.findByText(/permiso/i);
    expect(api.requests.some((request) => request.path.includes("egg-counts"))).toBe(false);
  });

  test("shows a retryable queue error and then the empty state", async () => {
    const { api } = await openCount({ routes: { "GET /api/v1/egg-counts/queue/": apiError(503, "unavailable") } });
    await screen.findByRole("alert");
    api.setRoute("GET /api/v1/egg-counts/queue/", pageOf([]));
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("No hay bolsas recibidas pendientes de conteo.")).toBeDefined();
  });

  test("exposes English keyboard hints and accessible controls", async () => {
    const { app } = await openCount({ language: "en" });
    await screen.findByRole("textbox", { name: "Laboratory eggs" });
    expect(screen.getByText(/Enter.*save/i)).toBeDefined();
    expect((await axe(app.container)).violations).toEqual([]);
  });
});

test("history preserves voided observations and corrects through an atomic void plus replacement", async () => {
  let observations = [count(), count({ id: "old-count", voided: true, is_current: false, value: 8 })];
  const { api } = await openCount({ history: true, routes: {
    "GET /api/v1/egg-counts/": ({ path }) => pageOf(path.includes("include_voided=true") ? observations : observations.filter((item) => !item.voided)),
    "GET /api/v1/catalogs/void-reason/items/": pageOf(makeVoidReasonItems()),
    [`GET /api/v1/egg-counts/${COUNT}/void-context/`]: Response.json({ id: COUNT, kind: "count", bag_id: BAG, current_revision: 1, is_current: true, blocked_by: [] }),
    [`POST /api/v1/egg-counts/${COUNT}/void/`]: () => { observations = [count({ id: "replacement-count", value: 15 }), count({ voided: true, is_current: false }), observations[1]!]; return Response.json({ void_id: "void-31", current_revision: 2, count: count({ value: 15 }), rejection: null, next_bag: null, queue_snapshot: { as_of: "2026-11-03T15:00:00Z", context: {} } }); },
  } });
  await screen.findAllByText("counter-31");
  await userEvent.click(screen.getByRole("switch", { name: "Incluir anulados" }));
  expect(await screen.findByText("Anulado")).toBeDefined();
  await userEvent.click(screen.getByRole("button", { name: "Corregir conteo" }));
  await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Motivo de anulación" }), "duplicate");
  await userEvent.type(screen.getByRole("textbox", { name: "Explicación" }), "Incorrect observation");
  await userEvent.type(screen.getByRole("textbox", { name: "Nuevo conteo" }), "15");
  await userEvent.click(screen.getByRole("button", { name: "Anular y guardar corrección" }));
  await waitFor(() => { expect(api.requests.find((request) => request.method === "POST")?.body).toMatchObject({ expected_revision: 1, reason_code: "duplicate", reason: "Incorrect observation", replacement: { kind: "count", value: 15 } }); });
  expect(await screen.findByText("15")).toBeDefined();
  expect(screen.getByText("12")).toBeDefined();
  expect(api.requests.filter((request) => request.path.startsWith("/api/v1/egg-counts/?")).every((request) => !new URL(request.path, "https://test.invalid").searchParams.has("center"))).toBe(true);
  expect(api.requests.filter((request) => ["PATCH", "PUT", "DELETE"].includes(request.method))).toEqual([]);
});
