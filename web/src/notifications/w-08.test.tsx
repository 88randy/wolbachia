import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { createFakeApi, makeMe, apiError, noContent } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { renderApp } from "../test/render-app";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import type { Notification, NotificationPage, Preferences } from "./notification-query";

const ID = "00000000-0000-4000-8000-000000000150";
const LIST = "GET /api/v1/notifications/";
const PREF = "GET /api/v1/me/notification-preferences/";
const permissions = ["notification.read", "notification_preference.update"];
const notification: Notification = {
  id: ID,
  kind: "incident",
  code: "incident.created",
  params: {},
  created_at: "2026-11-01T12:00:00Z",
  read_at: null,
  object_ref: null,
};
const page: NotificationPage = {
  results: [notification],
  next: null,
  previous: null,
  unread_total: 1,
};
const preferences: Preferences = {
  preferences: [
    { kind: "critical", in_app: true, email: true, required_in_app: true, required_email: true },
    { kind: "incident", in_app: true, email: false, required_in_app: false, required_email: false },
  ],
};
const member = makeMe({
  permissions,
  scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
async function open(routes: FakeApiRoutes = {}, path = "/notifications") {
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(member),
    [LIST]: () => Response.json(page),
    [PREF]: () => Response.json(preferences),
    ...routes,
  });
  return { api, app: await renderApp({ path, fetch: api.fetch }) };
}
const badge = () => screen.getByRole("button", { name: /Notificaciones · Sin leer:/ });

test("read rollback preserves the badge and retry explicitly sends the write, then read-all reconciles", async () => {
  const pending = deferred<Response>();
  const { api, app } = await open({
    [`POST /api/v1/notifications/${ID}/read/`]: () => pending.promise,
  });
  await screen.findByText("Se registró un incidente.");
  await userEvent.click(screen.getByRole("button", { name: "Marcar como leída" }));
  await waitFor(() => {
    expect(badge().getAttribute("aria-label")).toContain("Sin leer: 0");
  });
  act(() => {
    pending.resolve(apiError(500, "server_error"));
  });
  await screen.findByText(/Se restauró el estado anterior/);
  expect(badge().getAttribute("aria-label")).toContain("Sin leer: 1");
  api.setRoute(`POST /api/v1/notifications/${ID}/read/`, noContent());
  api.setRoute(LIST, () =>
    Response.json({
      ...page,
      unread_total: 0,
      results: [{ ...notification, read_at: notification.created_at }],
    }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByText("Cambios guardados.");
  expect(badge().getAttribute("aria-label")).toContain("Sin leer: 0");
  api.setRoute(LIST, () => Response.json(page));
  await act(async () => {
    await invalidateOrgScoped(app.queryClient, "notifications");
  });
  await waitFor(() => {
    expect(badge().getAttribute("aria-label")).toContain("Sin leer: 1");
  });
  api.setRoute("POST /api/v1/notifications/read-all/", () => {
    api.setRoute(LIST, () =>
      Response.json({
        ...page,
        unread_total: 0,
        results: [{ ...notification, read_at: notification.created_at }],
      }),
    );
    return noContent();
  });
  await userEvent.click(screen.getByRole("button", { name: "Marcar todas como leídas" }));
  await waitFor(() => {
    expect(badge().getAttribute("aria-label")).toContain("Sin leer: 0");
  });
  expect(api.requests.filter((row) => row.method === "POST")).toHaveLength(3);
});

test("preferences enforce required channels and roll back a failed optional change without replay", async () => {
  const pending = deferred<Response>();
  const { api } = await open({
    "PATCH /api/v1/me/notification-preferences/": () => pending.promise,
  });
  const critical = await screen.findByRole("group", { name: "Críticos" });
  expect(
    within(critical).getByRole<HTMLInputElement>("switch", { name: "Correo electrónico" }).disabled,
  ).toBe(true);
  const optional = screen.getByRole("group", { name: "Incidentes" });
  const email = within(optional).getByRole<HTMLInputElement>("switch", {
    name: "Correo electrónico",
  });
  await userEvent.click(email);
  await waitFor(() => {
    expect(email.checked).toBe(true);
  });
  act(() => {
    pending.resolve(apiError(400, "required_channel"));
  });
  await screen.findByText(/Se restauró el estado anterior/);
  expect(email.checked).toBe(false);
  expect(api.requests.filter((row) => row.method === "PATCH").map((row) => row.body)).toEqual([
    { preferences: [{ kind: "incident", in_app: true, email: true }] },
  ]);
});

test("reconnect during a failed read retains new authoritative rows and the unread total", async () => {
  const pending = deferred<Response>();
  const { api } = await open({
    [`POST /api/v1/notifications/${ID}/read/`]: () => pending.promise,
  });
  await screen.findByText("Se registró un incidente.");
  await userEvent.click(screen.getByRole("button", { name: "Marcar como leída" }));
  await waitFor(() => {
    expect(badge().getAttribute("aria-label")).toContain("Sin leer: 0");
  });
  api.setRoute(LIST, () =>
    Response.json({
      ...page,
      unread_total: 2,
      results: [
        {
          ...notification,
          id: "00000000-0000-4000-8000-000000000151",
          code: "notification.system",
          kind: "system",
        },
        notification,
      ],
    }),
  );
  act(() => {
    window.dispatchEvent(new Event("offline"));
  });
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
  await screen.findByText("Hay una actualización del sistema.");
  act(() => {
    pending.resolve(apiError(500, "server_error"));
  });
  await screen.findByText(/Se restauró el estado anterior/);
  expect(badge().getAttribute("aria-label")).toContain("Sin leer: 2");
  expect(screen.getAllByText("Se registró un incidente.")).toHaveLength(1);
  expect(screen.getByText("Hay una actualización del sistema.")).toBeDefined();
});

test("scope loss cancels a delayed cursor response and removes inaccessible content", async () => {
  const pending = deferred<Response>();
  const { api, app } = await open();
  await screen.findByText("Se registró un incidente.");
  api.setRoute(LIST, () => pending.promise);
  let refresh!: Promise<void>;
  act(() => {
    refresh = invalidateOrgScoped(app.queryClient, "notifications");
  });
  api.setRoute("GET /api/v1/me/", () =>
    Response.json({
      ...member,
      scope: { ...member.scope, centers: { mode: "selected", ids: [] } },
    }),
  );
  await act(async () => {
    await app.queryClient.invalidateQueries({ queryKey: ["me"] });
  });
  await screen.findByText(/Tu alcance no permite abrir la bandeja/);
  await act(async () => {
    pending.resolve(Response.json(page));
    await refresh;
  });
  expect(screen.queryByText("Se registró un incidente.")).toBeNull();
  expect(screen.queryByRole("button", { name: /Notificaciones ·/ })).toBeNull();
});

test("panel announces real unread total and Escape returns focus to its trigger", async () => {
  const { api, app } = await open({}, "/");
  const bell = await screen.findByRole("button", { name: "Notificaciones · Sin leer: 1" });
  await userEvent.click(bell);
  const panel = await screen.findByRole("dialog", { name: "Notificaciones" });
  expect(within(panel).getByText("Se registró un incidente.")).toBeDefined();
  const focused = document.activeElement;
  api.setRoute(LIST, () =>
    Response.json({
      ...page,
      unread_total: 2,
      results: [
        {
          ...notification,
          id: "00000000-0000-4000-8000-000000000151",
          code: "notification.system",
          kind: "system",
        },
        notification,
      ],
    }),
  );
  await act(async () => {
    await invalidateOrgScoped(app.queryClient, "notifications");
  });
  expect((await within(panel).findByText("Sin leer: 2")).getAttribute("role")).toBe("status");
  expect(document.activeElement).toBe(focused);
  await userEvent.keyboard("{Escape}");
  await waitFor(() => {
    expect(document.activeElement).toBe(bell);
  });
});

test("inbox state wiring supports loading, retry after failure, empty and offline read blocking", async () => {
  const pending = deferred<Response>();
  const { api, app } = await open({ [LIST]: () => pending.promise });
  expect(screen.getAllByRole("status", { name: "Cargando contenido" }).length).toBeGreaterThan(0);
  act(() => {
    pending.resolve(apiError(500, "server_error"));
  });
  await screen.findByRole("alert");
  api.setRoute(LIST, () => Response.json({ ...page, unread_total: 0, results: [] }));
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await waitFor(() => {
    expect(screen.queryByRole("alert")).toBeNull();
  });
  expect(
    screen.getByRole("button", { name: "Marcar todas como leídas" }).getAttribute("aria-disabled"),
  ).toBe("true");
  api.setRoute(LIST, () => Response.json(page));
  await act(async () => {
    await invalidateOrgScoped(app.queryClient, "notifications");
  });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  act(() => {
    window.dispatchEvent(new Event("offline"));
  });
  expect(
    screen.getByRole("button", { name: "Marcar como leída" }).getAttribute("aria-disabled"),
  ).toBe("true");
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
});

test("unknown or foreign references share an unavailable destination and missing read permission denies deep links", async () => {
  const { api, app } = await open({
    [LIST]: () =>
      Response.json({
        ...page,
        results: [
          {
            ...notification,
            object_ref: {
              kind: "incident",
              available: false,
              id: null,
              code: null,
              is_voided: null,
            },
          },
        ],
      }),
  });
  await screen.findByText("El registro no está disponible con tu acceso actual.");
  expect(screen.queryByRole("link", { name: "Abrir registro" })).toBeNull();
  api.setRoute("GET /api/v1/me/", () => Response.json({ ...member, permissions: [] }));
  await act(async () => {
    await app.queryClient.invalidateQueries({ queryKey: ["me"] });
  });
  expect(screen.queryByText("Se registró un incidente.")).toBeNull();
});
