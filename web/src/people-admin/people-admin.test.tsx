import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { centerStorageKey, writeCenter } from "../centers/center-selection";
import { endSessionExpiry } from "../session/session-events";
import { apiError, createFakeApi, makeMe } from "../test/fake-api";
import type { FakeApiRoutes } from "../test/fake-api";
import { renderApp } from "../test/render-app";

const ALL = { mode: "all" as const, ids: [] };
const NONE = { mode: "none" as const, ids: [] };
const ME = makeMe({
  permissions: [
    "user.read",
    "user.create",
    "user.update",
    "user.deactivate",
    "role.read",
    "role.update",
    "center.read",
  ],
  scope: { centers: ALL, quadrants: ALL },
});
const page = (results: unknown[]) => ({
  results,
  count: results.length,
  next: null,
  previous: null,
});
const CENTER = { id: "center-1", code: "C-01", name: "Centro Norte" };
const PROFILE = {
  id: "profile-a",
  slug: "collector",
  label_es: "Repartidor",
  label_en: "Courier",
  permissions: ["incident.read"],
  scope: { centers: ALL, quadrants: ALL },
  revision: 1,
  is_active: true,
};
const OTHER_PROFILE = { ...PROFILE, id: "profile-b", slug: "lab", label_es: "Laboratorio" };
const PERSON = {
  id: "user-1",
  personnel_id: "personnel-1",
  membership_id: "membership-1",
  display_name: "Luis Mora",
  center_id: CENTER.id,
  quadrant_id: null,
  work_email: "",
  work_phone: "",
  revision: 4,
  is_active: true,
  has_rfc: false,
};
const MEMBERSHIP = {
  id: "membership-1",
  user: PERSON.id,
  user_display_name: PERSON.display_name,
  profiles: [PROFILE.id],
  scope: { centers: { mode: "selected" as const, ids: [CENTER.id] }, quadrants: NONE },
  is_active: true,
  revision: 7,
  created_at: "2026-11-01T00:00:00Z",
  created_by: null,
};

function routes(extra: FakeApiRoutes = {}): FakeApiRoutes {
  return {
    "GET /api/v1/me/": () => Response.json(ME),
    "GET /api/v1/users/": Response.json(page([PERSON])),
    "GET /api/v1/users/user-1/": Response.json(PERSON),
    "GET /api/v1/roles/": Response.json(page([PROFILE, OTHER_PROFILE])),
    "GET /api/v1/memberships/": Response.json(page([MEMBERSHIP])),
    "GET /api/v1/memberships/membership-1/": Response.json(MEMBERSHIP),
    "GET /api/v1/centers/": Response.json(page([CENTER])),
    ...extra,
  };
}

async function open(path: string, extra: FakeApiRoutes = {}) {
  const api = createFakeApi(routes(extra));
  await renderApp({ path, fetch: api.fetch });
  return { api, user: userEvent.setup() };
}

const bodyOf = (api: ReturnType<typeof createFakeApi>, method: string, path: string) =>
  api.requests.find((request) => request.method === method && request.path === path)?.body;
const count = (api: ReturnType<typeof createFakeApi>, method: string, path: string) =>
  api.requests.filter((request) => request.method === method && request.path === path).length;

beforeEach(() => {
  endSessionExpiry();
  writeCenter(centerStorageKey(ME), "");
  document.cookie = "csrftoken=test-csrf; path=/";
});
afterEach(() => {
  vi.restoreAllMocks();
  endSessionExpiry();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});

async function fillNewUser(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Nuevo usuario" }));
  const dialog = screen.getByRole("dialog");
  await user.type(within(dialog).getByLabelText("Nombre completo"), "Luis Mora");
  await user.type(within(dialog).getByLabelText("Usuario para iniciar sesión"), "lmora");
  await within(dialog).findByRole("option", { name: "Centro Norte" });
  await user.selectOptions(within(dialog).getByLabelText("Centro"), CENTER.id);
  await user.selectOptions(within(dialog).getByLabelText("Perfil"), PROFILE.id);
  return dialog;
}

describe("W48 new user", () => {
  test("creates the login, assigns profile and scope, and shows the temporary password once", async () => {
    const { api, user } = await open("/settings/users", {
      "POST /api/v1/users/": Response.json(PERSON, { status: 201 }),
      "POST /api/v1/memberships/membership-1/change-scope/": Response.json(MEMBERSHIP),
      "POST /api/v1/users/user-1/temporary-password/": Response.json({
        temporary_password: "Temp-Secret-123",
        expires_at: "2026-11-12T18:00:00Z",
      }),
    });
    const dialog = await fillNewUser(user);
    await user.click(within(dialog).getByRole("button", { name: "Crear usuario" }));
    await within(dialog).findByText(/Se asignaron el perfil y el alcance/);
    expect(bodyOf(api, "POST", "/api/v1/users/")).toEqual({
      display_name: "Luis Mora",
      username: "lmora",
      center_id: CENTER.id,
    });
    expect(bodyOf(api, "POST", "/api/v1/memberships/membership-1/change-scope/")).toEqual({
      expected_revision: 7,
      profiles: [PROFILE.id],
      scope: { centers: { mode: "selected", ids: [CENTER.id] }, quadrants: ALL },
    });
    await user.click(within(dialog).getByRole("button", { name: "Generar contraseña temporal" }));
    expect((await within(dialog).findByTestId("temporary-password")).textContent).toBe(
      "Temp-Secret-123",
    );
    expect(within(dialog).getByText(/Se muestra una sola vez/)).toBeDefined();
    await user.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.queryByText("Temp-Secret-123")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    expect(screen.queryByText("Temp-Secret-123")).toBeNull();
  });

  test("a failed assignment keeps the created user and retries only the assignment", async () => {
    const { api, user } = await open("/settings/users", {
      "POST /api/v1/users/": Response.json(PERSON, { status: 201 }),
      "POST /api/v1/memberships/membership-1/change-scope/": apiError(503, "service_unavailable"),
    });
    const dialog = await fillNewUser(user);
    await user.click(within(dialog).getByRole("button", { name: "Crear usuario" }));
    await within(dialog).findByText(/todavía no tiene perfil ni alcance/);
    api.setRoute("POST /api/v1/memberships/membership-1/change-scope/", Response.json(MEMBERSHIP));
    await user.click(within(dialog).getByRole("button", { name: "Reintentar asignación" }));
    await within(dialog).findByText(/Se asignaron el perfil y el alcance/);
    expect(count(api, "POST", "/api/v1/users/")).toBe(1);
    expect(count(api, "POST", "/api/v1/memberships/membership-1/change-scope/")).toBe(2);
  });

  test("the button is hidden without user.create and role.update", async () => {
    const me = makeMe({ permissions: ["user.read", "user.create"], scope: ME.scope });
    await open("/settings/users", {
      "GET /api/v1/me/": () => Response.json(me),
    });
    await screen.findByText("Luis Mora");
    expect(screen.queryByRole("button", { name: "Nuevo usuario" })).toBeNull();
  });
});

describe("W49 person actions", () => {
  test("changing profile and scope sends the profiles and the scope", async () => {
    const { api, user } = await open("/settings/users/user-1", {
      "POST /api/v1/memberships/membership-1/change-scope/": Response.json(MEMBERSHIP),
    });
    await user.click(await screen.findByRole("button", { name: "Cambiar perfil y alcance" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("checkbox", { name: "Laboratorio" });
    expect(
      within(dialog).getByRole<HTMLInputElement>("checkbox", { name: "Repartidor" }).checked,
    ).toBe(true);
    await user.click(within(dialog).getByRole("checkbox", { name: "Laboratorio" }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => {
      expect(bodyOf(api, "POST", "/api/v1/memberships/membership-1/change-scope/")).toEqual({
        expected_revision: 7,
        profiles: [PROFILE.id, OTHER_PROFILE.id],
        scope: MEMBERSHIP.scope,
      });
    });
  });

  test("temporary password errors map to a message and nothing is shown", async () => {
    const { user } = await open("/settings/users/user-1", {
      "POST /api/v1/users/user-1/temporary-password/": apiError(400, "validation_error", {
        fields: { user: [{ code: "shared_account" }] },
      }),
    });
    await user.click(await screen.findByRole("button", { name: "Generar contraseña temporal" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Generar contraseña temporal" }));
    await within(dialog).findByText(/también inicia sesión en otra organización/);
    expect(within(dialog).queryByTestId("temporary-password")).toBeNull();
  });

  test("deactivating confirms first and sends the person revision; an own-administration refusal is explained", async () => {
    const { api, user } = await open("/settings/users/user-1", {
      "POST /api/v1/users/user-1/deactivate/": apiError(409, "own_administration"),
    });
    await user.click(await screen.findByRole("button", { name: "Dar de baja" }));
    const confirm = await screen.findByRole("dialog");
    await user.click(within(confirm).getByRole("button", { name: "Dar de baja" }));
    await screen.findByText(/No puedes quitarte tus propios permisos de administración/);
    expect(bodyOf(api, "POST", "/api/v1/users/user-1/deactivate/")).toEqual({
      expected_revision: 4,
    });
  });

  test("an inactive person shows Reactivate and blocks the other actions with the reason", async () => {
    const { api, user } = await open("/settings/users/user-1", {
      "GET /api/v1/users/user-1/": Response.json({ ...PERSON, is_active: false }),
      "POST /api/v1/memberships/membership-1/change-scope/": Response.json(MEMBERSHIP),
    });
    const blocked = await screen.findByRole("button", { name: "Cambiar perfil y alcance" });
    expect(blocked.getAttribute("aria-disabled")).toBe("true");
    expect(blocked.getAttribute("title")).toMatch(/está de baja/);
    expect(screen.queryByRole("button", { name: "Dar de baja" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Reactivar" }));
    await waitFor(() => {
      expect(bodyOf(api, "POST", "/api/v1/memberships/membership-1/change-scope/")).toEqual({
        expected_revision: 7,
        profiles: [PROFILE.id],
        scope: MEMBERSHIP.scope,
        is_active: true,
      });
    });
  });
});

describe("W65 profiles", () => {
  test("shows active members per profile and copies a profile with both names", async () => {
    const { api, user } = await open("/settings/roles", {
      "POST /api/v1/roles/": Response.json({ ...PROFILE, id: "profile-new" }, { status: 201 }),
    });
    const link = await screen.findByRole("link", {
      name: "Ver los usuarios activos del perfil Repartidor",
    });
    expect(link.textContent).toBe("1 activos");
    expect(link.getAttribute("href")).toContain("profiles=profile-a");
    await user.click(
      (await screen.findAllByRole("button", { name: "Copiar perfil" }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre en español"), "Repartidor norte");
    await user.type(within(dialog).getByLabelText("Nombre en inglés"), "North courier");
    await user.click(within(dialog).getByRole("button", { name: "Crear copia" }));
    await waitFor(() => {
      expect(bodyOf(api, "POST", "/api/v1/roles/")).toEqual({
        copy_from: PROFILE.id,
        label_es: "Repartidor norte",
        label_en: "North courier",
      });
    });
  });

  test("the memberships view shows the user name and profile labels", async () => {
    await open("/settings/roles?view=memberships");
    expect(await screen.findByText("Luis Mora")).toBeDefined();
    expect(await screen.findByText("Repartidor")).toBeDefined();
  });
});
