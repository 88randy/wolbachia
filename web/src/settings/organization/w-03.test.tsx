import * as meQuery from "../../session/me-query";
import { sessionState } from "../../session/session-revision";
import { reconcileSession } from "../../session/session-reconcile";
import { messages } from "@wolbachia/i18n";
import type { Profile } from "./use-w-03";
import { isSessionKnown } from "../../session/session-revision";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { endSessionExpiry } from "../../session/session-events";
import { ME_QUERY_KEY } from "../../session/me-key";
import { centerStorageKey, writeCenter } from "../../centers/center-selection";
import { fakePassword } from "../../test/fake-credentials";
import { apiError, createFakeApi, makeMe, makeOrganization } from "../../test/fake-api";
import type { RecordedRequest } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
const SCOPE = {
  centers: { mode: "all" as const, ids: [] },
  quadrants: { mode: "all" as const, ids: [] },
};
const ME = makeMe({
  permissions: [
    "role.read",
    "role.update",
    "organization.read",
    "organization.update",
    "center.read",
  ],
  scope: SCOPE,
});
const ROLE = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "custom",
  label_es: "Equipo",
  label_en: "Team",
  permissions: ["role.read", "role.update"],
  scope: SCOPE,
  revision: 3,
  is_active: true,
};
const ORGANIZATION = { ...makeOrganization("norte", "Programa"), revision: 4 };
const page = (results: unknown[]) => ({
  results,
  count: results.length,
  next: null,
  previous: null,
});
const PROFILES = [
  ROLE,
  { ...ROLE, id: "second", label_es: "Equipo dos", label_en: "Second team" },
  {
    ...ROLE,
    id: "external",
    label_es: "Consulta",
    label_en: "Consultation",
    permissions: ["portal.read"],
  },
];
async function open(path = "/settings/roles", me = ME, profiles: Profile[] = PROFILES) {
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(me),
    "GET /api/v1/roles/": () => Response.json(page(profiles)),
    "GET /api/v1/roles/00000000-0000-4000-8000-000000000001/": Response.json(ROLE),
    "GET /api/v1/memberships/": Response.json(page([])),
    "GET /api/v1/centers/": Response.json(page([])),
    "GET /api/v1/organization/": () => Response.json(ORGANIZATION),
    "PUT /api/v1/roles/00000000-0000-4000-8000-000000000001/permissions/": apiError(
      409,
      "last_administrator",
    ),
    "PATCH /api/v1/organization/": () =>
      Response.json({
        ...ORGANIZATION,
        revision: 5,
        timezone: "UTC",
        epi_week: "mmwr",
      }),
  });
  return { api, app: await renderApp({ path, fetch: api.fetch }), user: userEvent.setup() };
}
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
describe("W-03", () => {
  test("keyboard edit sends exact scope; last-admin refusal preserves draft and revision", async () => {
    const profiles = [
      ...PROFILES,
      ...Array.from({ length: 6 }, (_, index) => ({
        ...ROLE,
        id: `bundle-${String(index)}`,
        label_es: `Perfil ${String(index)}`,
        permissions: [],
      })),
    ];
    const { api, user } = await open("/settings/roles", ME, profiles);
    const cell = await screen.findByRole("button", { name: /^Equipo: role.update / });
    const denied = screen.getByRole("button", { name: "Equipo: center.read Sin permiso" });
    for (const button of [cell, denied])
      expect(button.getAttribute("aria-label")).toContain(button.textContent.trim());
    cell.focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Equipo dos: role.update / }),
    );
    await user.keyboard("{ArrowUp}{Enter}");
    const dialog = screen.getByRole("dialog");
    within(dialog).getByRole("checkbox", { name: "role.update" }).focus();
    await user.keyboard(" ");
    const centerMode = within(
      within(dialog).getByRole("group", { name: "Centros" }),
    ).getByRole<HTMLSelectElement>("combobox");
    await user.selectOptions(centerMode, "none");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await screen.findByText(/Debe permanecer al menos una persona administradora/);
    expect(api.requests.find((request) => request.method === "PUT")?.body).toEqual({
      permissions: ["role.read"],
      scope: { ...SCOPE, centers: { mode: "none", ids: [] } },
      expected_revision: 3,
    });
    expect(
      within(dialog).getByRole<HTMLInputElement>("checkbox", { name: "role.update" }).checked,
    ).toBe(false);
    expect(within(dialog).getByText(/Revisión vigente: 3/)).toBeDefined();
    expect(centerMode.value).toBe("none");
    expect(cell.getAttribute("aria-pressed")).toBe("true");
    expect(cell.isConnected).toBe(false);
    fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Equipo: role.update / }),
    );
    expect(document.activeElement?.isConnected).toBe(true);
    expect(screen.queryByRole("button", { name: /^Consulta: role.update / })).toBeNull();
  });
  test("settings timezone/epi week roundtrip and invalid logo", async () => {
    const { api, user, app } = await open("/settings/organization");
    const timezone = await screen.findByRole("textbox", { name: "Zona horaria" });
    await user.clear(timezone);
    await user.type(timezone, "UTC");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Semana epidemiológica" }),
      "mmwr",
    );
    fireEvent.change(screen.getByLabelText("Logotipo"), {
      target: { files: [new File(["svg"], "logo.svg", { type: "image/svg+xml" })] },
    });
    expect(await screen.findByText(/Elige una imagen PNG, JPEG o WebP/)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByText("Cambios guardados");
    expect(api.requests.find((request) => request.method === "PATCH")?.body).toMatchObject({
      timezone: "UTC",
      epi_week: "mmwr",
      expected_revision: 4,
    });
    expect(
      api.requests.some((request) => request.path.includes("logo") && request.method === "POST"),
    ).toBe(false);
    expect(await axe(app.container)).toHaveNoViolations();
  });
});

test("a refused write is never replayed after reauthentication, and the retained draft can be saved manually", async () => {
  const { api, user } = await open();
  api.setRoute("PUT /api/v1/roles/00000000-0000-4000-8000-000000000001/permissions/", () =>
    apiError(401, "not_authenticated"),
  );
  api.setRoute("POST /api/v1/auth/login/", () =>
    Response.json({ me: ME, server_time: "2026-11-05T12:00:00Z" }),
  );
  await user.click(await screen.findByRole("button", { name: /^Equipo: role.update / }));
  const editor = screen.getByRole("dialog");
  await user.click(within(editor).getByRole("checkbox", { name: "role.update" }));
  await user.click(within(editor).getByRole("button", { name: "Guardar" }));
  const reauth = await screen.findByRole("dialog", { name: "Tu sesión terminó" });
  await user.click(within(reauth).getByLabelText("Contraseña"));
  await user.paste(fakePassword());
  await user.click(within(reauth).getByRole("button", { name: "Continuar" }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Tu sesión terminó" })).toBeNull();
  });
  await waitFor(() => {
    expect(
      within(editor)
        .getByRole<HTMLButtonElement>("button", { name: "Guardar" })
        .getAttribute("aria-disabled"),
    ).toBe("false");
  });
  expect(api.requests.filter((request) => request.method === "PUT")).toHaveLength(1);
  expect(
    within(editor).getByRole<HTMLInputElement>("checkbox", { name: "role.update" }).checked,
  ).toBe(false);
});

test("concurrent permission edits require an explicit refresh and review without replacing draft input", async () => {
  const { api, user } = await open();
  api.setRoute("PUT /api/v1/roles/00000000-0000-4000-8000-000000000001/permissions/", () =>
    apiError(409, "stale_revision"),
  );
  api.setRoute("GET /api/v1/roles/00000000-0000-4000-8000-000000000001/", () =>
    Response.json({ ...ROLE, revision: 7 }),
  );
  await user.click(await screen.findByRole("button", { name: /^Equipo: role.update / }));
  const dialog = screen.getByRole("dialog");
  await user.click(within(dialog).getByRole("checkbox", { name: "role.update" }));
  await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
  await screen.findByText(/La configuración cambió/);
  expect(
    within(dialog)
      .getByRole<HTMLButtonElement>("button", { name: "Guardar" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
  api.setRoute("GET /api/v1/roles/00000000-0000-4000-8000-000000000001/", () =>
    apiError(503, "server_error"),
  );
  await user.click(within(dialog).getByRole("button", { name: "Consultar revisión vigente" }));
  await within(dialog).findByRole("button", { name: "Consultar revisión vigente" });
  await waitFor(() => {
    expect(
      within(dialog).getByRole<HTMLButtonElement>("button", { name: "Consultar revisión vigente" })
        .disabled,
    ).toBe(false);
  });
  expect(
    within(dialog).getByRole("button", { name: "Guardar" }).getAttribute("aria-disabled"),
  ).toBe("true");
  api.setRoute("GET /api/v1/roles/00000000-0000-4000-8000-000000000001/", () =>
    Response.json({ ...ROLE, revision: 7 }),
  );
  await user.click(within(dialog).getByRole("button", { name: "Consultar revisión vigente" }));
  await screen.findByText("Revisión vigente: 7");
  expect(
    within(dialog).getByRole<HTMLInputElement>("checkbox", { name: "role.update" }).checked,
  ).toBe(false);
  expect(
    within(dialog)
      .getByRole<HTMLButtonElement>("button", { name: "Guardar" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
  await user.click(within(dialog).getByRole("button", { name: "Ya revisé: usar esta revisión" }));
  expect(
    within(dialog)
      .getByRole<HTMLButtonElement>("button", { name: "Guardar" })
      .getAttribute("aria-disabled"),
  ).toBe("false");
});

test("membership scope resolves unknown and foreign center codes identically and sends selected ids only", async () => {
  const { api, user } = await open();
  const member = {
    id: "member",
    user: ME.user.id,
    profiles: [ROLE.id],
    scope: SCOPE,
    is_active: true,
    revision: 6,
    created_at: "2026-11-01T00:00:00Z",
    created_by: null,
  };
  api.setRoute("GET /api/v1/memberships/", () => Response.json(page([member])));
  api.setRoute("GET /api/v1/centers/", (request) =>
    Response.json(
      page(
        new URL(request.path, "http://localhost").searchParams.get("code") === "C-01"
          ? [{ id: "00000000-0000-4000-8000-000000000011", code: "C-01", name: "Centro" }]
          : [],
      ),
    ),
  );
  api.setRoute("GET /api/v1/centers/00000000-0000-4000-8000-000000000011/", () =>
    Response.json({ id: "00000000-0000-4000-8000-000000000011", code: "C-01", name: "Centro" }),
  );
  api.setRoute("POST /api/v1/memberships/member/change-scope/", () => Response.json(member));
  await user.selectOptions(await screen.findByRole("combobox", { name: "Vista" }), "memberships");
  await user.click(await screen.findByRole("button", { name: "Editar alcance" }));
  const centers = within(screen.getByRole("group", { name: "Centros" }));
  await user.selectOptions(centers.getByRole("combobox"), "selected");
  for (const code of ["UNKNOWN", "FOREIGN"]) {
    await user.clear(centers.getByRole("textbox"));
    await user.paste(code);
    await user.click(centers.getByRole("button", { name: "Agregar código" }));
    expect((await centers.findByRole("alert")).textContent).toBe(
      "Código no disponible en tu alcance. Revisa el código o pide acceso a una persona administradora.",
    );
  }
  await user.clear(centers.getByRole("textbox"));
  await user.paste("C-01");
  await user.click(centers.getByRole("button", { name: "Agregar código" }));
  await centers.findByRole("button", { name: /Quitar referencia/ });
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Guardar" }));
  await screen.findByText("Cambios guardados");
  expect(
    api.requests.find(
      (request) => request.method === "POST" && request.path.includes("change-scope"),
    )?.body,
  ).toEqual({
    expected_revision: 6,
    scope: {
      ...SCOPE,
      centers: { mode: "selected", ids: ["00000000-0000-4000-8000-000000000011"] },
    },
  });
});

test("a center-scope change clears old configuration results and reloads the permitted global route", async () => {
  const { api, app } = await open();
  await screen.findByRole("button", { name: /^Equipo: role.update / });
  const [previous] = app.queryClient.getQueriesData({
    predicate: (query) => query.queryKey[4] === "roles",
  });
  const oldKey = previous?.[0];
  if (!oldKey) throw new Error("Missing roles query");
  api.setRoute("GET /api/v1/roles/", () =>
    Response.json(page([{ ...ROLE, label_es: "Equipo vigente" }])),
  );
  api.setRoute("GET /api/v1/me/", () =>
    Response.json({ ...ME, scope: { ...SCOPE, centers: { mode: "none", ids: [] } } }),
  );
  await act(async () => {
    await app.queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
  });
  await screen.findByRole("button", { name: /^Equipo vigente: role.update / });
  expect(screen.queryByRole("button", { name: /^Equipo: role.update / })).toBeNull();
  expect(app.queryClient.getQueryData(oldKey)).toBeUndefined();
  expect(screen.queryByRole("heading", { name: "No tienes acceso a esta sección" })).toBeNull();
});
test("draft fields remain locked until the saved change finishes session verification", async () => {
  const { api, user } = await open();
  let release: (reply: Response) => void = () => {
    throw new Error("Missing barrier");
  };
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  api.setRoute("PUT /api/v1/roles/00000000-0000-4000-8000-000000000001/permissions/", () =>
    Response.json(ROLE),
  );
  api.setRoute("GET /api/v1/me/", () => pending);
  await user.click(await screen.findByRole("button", { name: /^Equipo: role.update / }));
  const editor = screen.getByRole("dialog");
  await user.click(within(editor).getByRole("button", { name: "Guardar" }));
  await waitFor(() => {
    expect(api.requests.filter((request) => request.path === "/api/v1/me/")).toHaveLength(2);
  });
  expect(
    within(editor).getByRole<HTMLInputElement>("checkbox", { name: "role.update" }).disabled ||
      within(editor).getByRole("checkbox", { name: "role.update" }).closest("fieldset:disabled") !==
        null,
  ).toBe(true);
  await act(async () => {
    release(Response.json(ME));
    await pending;
  });
  await screen.findByText("Cambios guardados");
});

test("a saved change with failed session verification closes the context without replay or unhandled rejection", async () => {
  const { api, user } = await open("/settings/organization");
  await screen.findByRole("textbox", { name: "Zona horaria" });
  api.setRoute("GET /api/v1/me/", () => apiError(503, "server_error"));
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => {
    expect(isSessionKnown()).toBe(false);
  });
  expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(1);
});

test("organization drafts survive same-user reauthentication without replaying the refused patch", async () => {
  const { api, user, app } = await open("/settings/organization");
  await screen.findByRole("textbox", { name: "Zona horaria" });
  api.setRoute("GET /api/v1/centers/", () =>
    Response.json(
      page([{ id: "00000000-0000-4000-8000-000000000011", code: "C-01", name: "Centro" }]),
    ),
  );
  api.setRoute("PATCH /api/v1/organization/", () => apiError(401, "not_authenticated"));
  api.setRoute("POST /api/v1/auth/login/", () =>
    Response.json({ me: ME, server_time: "2026-11-05T12:00:00Z" }),
  );
  const phone = screen.getByRole("textbox", { name: "Teléfono en etiquetas de ovitrampa" });
  await user.type(phone, "1234");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  const reauth = await screen.findByRole("dialog", { name: "Tu sesión terminó" });
  await user.click(within(reauth).getByLabelText("Contraseña"));
  await user.paste(fakePassword());
  await user.click(within(reauth).getByRole("button", { name: "Continuar" }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Tu sesión terminó" })).toBeNull();
  });
  await screen.findByRole("textbox", { name: "Teléfono en etiquetas de ovitrampa" });
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "Teléfono en etiquetas de ovitrampa" })
      .value,
  ).toBe("1234");
  await screen.findByRole("option", { name: "C-01 · Centro" });
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Filtro de centro" }),
    "00000000-0000-4000-8000-000000000011",
  );
  await waitFor(() => {
    expect(app.queryClient.isFetching()).toBe(0);
  });
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "Teléfono en etiquetas de ovitrampa" })
      .value,
  ).toBe("1234");
  expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(1);
});

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((release) => {
    resolve = release;
  });
  return { promise, resolve };
}
const CENTER_A = { id: "00000000-0000-4000-8000-000000000011", code: "C-A", name: "A" };
const CENTER_B = { id: "00000000-0000-4000-8000-000000000012", code: "C-B", name: "B" };
async function openScopeSearch(center = CENTER_B) {
  const role = {
    ...ROLE,
    scope: { ...SCOPE, centers: { mode: "selected" as const, ids: [CENTER_A.id] } },
  };
  const context = await open("/settings/roles", ME, [role]);
  const lookup = deferredResponse();
  context.api.setRoute("GET /api/v1/centers/", (request) =>
    new URL(request.path, "http://localhost").searchParams.has("code")
      ? lookup.promise
      : Response.json(page([CENTER_A])),
  );
  for (const center of [CENTER_A, CENTER_B])
    context.api.setRoute(`GET /api/v1/centers/${center.id}/`, () => Response.json(center));
  await context.user.click(await screen.findByRole("button", { name: /^Equipo: role.update / }));
  const centers = within(screen.getByRole("group", { name: "Centros" }));
  await centers.findByRole("button", { name: /Quitar referencia: C-A/ });
  await context.user.click(centers.getByRole("textbox"));
  await context.user.paste(center.code);
  await context.user.click(centers.getByRole("button", { name: "Agregar código" }));
  await waitFor(() => {
    expect(
      context.api.requests.some((request) => request.path.includes(`code=${center.code}`)),
    ).toBe(true);
  });
  return { ...context, lookup, centers, dialog: within(screen.getByRole("dialog")) };
}

test("search and remove the same center", async () => {
  const { api, user, lookup, centers, dialog } = await openScopeSearch(CENTER_A);
  expect(dialog.getByRole("button", { name: "Guardar" }).getAttribute("aria-disabled")).toBe(
    "true",
  );
  await user.click(dialog.getByRole("button", { name: "Guardar" }));
  expect(api.requests.some((request) => request.method === "PUT")).toBe(false);
  await user.click(centers.getByRole("button", { name: /Quitar referencia: C-A/ }));
  await user.selectOptions(
    within(screen.getByRole("group", { name: "Cuadrantes" })).getByRole("combobox"),
    "none",
  );
  await act(async () => {
    lookup.resolve(Response.json(page([CENTER_A])));
    await lookup.promise;
  });
  await waitFor(() => {
    expect(dialog.getByRole("button", { name: "Guardar" }).getAttribute("aria-disabled")).toBe(
      "false",
    );
  });
  expect(centers.queryByRole("button", { name: /Quitar referencia: C-A/ })).toBeNull();
  await user.click(dialog.getByRole("button", { name: "Guardar" }));
  await screen.findByText(/Debe permanecer al menos una persona administradora/);
  expect(api.requests.find((request) => request.method === "PUT")?.body).toEqual({
    permissions: ROLE.permissions,
    expected_revision: 3,
    scope: {
      centers: { mode: "selected", ids: [] },
      quadrants: { mode: "none", ids: [] },
    },
  });
});

test("changing scope mode discards an outstanding search even when returning to selected mode", async () => {
  const { api, user, lookup, centers, dialog } = await openScopeSearch();
  await user.selectOptions(centers.getByRole("combobox"), "none");
  await user.selectOptions(centers.getByRole("combobox"), "selected");
  await act(async () => {
    lookup.resolve(Response.json(page([CENTER_B])));
    await lookup.promise;
  });
  await waitFor(() => {
    expect(
      centers.getByRole<HTMLButtonElement>("button", { name: "Agregar código" }).disabled,
    ).toBe(true);
  });
  expect(centers.queryByRole("button", { name: /Quitar referencia/ })).toBeNull();
  await user.click(dialog.getByRole("button", { name: "Guardar" }));
  await screen.findByText(/Debe permanecer al menos una persona administradora/);
  expect(api.requests.find((request) => request.method === "PUT")?.body).toMatchObject({
    scope: { centers: { mode: "selected", ids: [] } },
  });
});

test("a delegated administrator can revoke a checked permission they cannot grant", async () => {
  const { api, user } = await open("/settings/roles", ME, [
    { ...ROLE, permissions: [...ROLE.permissions, "motorcycle.unblock"] },
  ]);
  await user.click(await screen.findByRole("button", { name: /^Equipo: motorcycle.unblock / }));
  const dialog = within(screen.getByRole("dialog"));
  const checkbox = dialog.getByRole<HTMLInputElement>("checkbox", { name: "motorcycle.unblock" });
  expect(checkbox.disabled).toBe(false);
  checkbox.focus();
  await user.keyboard(" ");
  expect(checkbox.checked).toBe(false);
  expect(checkbox.disabled).toBe(true);
  await user.click(dialog.getByRole("button", { name: "Guardar" }));
  await screen.findByText(/Debe permanecer al menos una persona administradora/);
  expect(api.requests.find((request) => request.method === "PUT")?.body).toEqual({
    permissions: ROLE.permissions,
    scope: SCOPE,
    expected_revision: 3,
  });
});

test("a successful settings patch publishes its revision before navigation and the next manual save", async () => {
  const { api, user, app } = await open("/settings/organization");
  const timezone = await screen.findByRole("textbox", { name: "Zona horaria" });
  await user.clear(timezone);
  await user.paste("UTC");
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await screen.findByText("Cambios guardados");
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Guardar" }).getAttribute("aria-disabled")).toBe(
      "false",
    );
  });
  const refresh = deferredResponse();
  const startRefresh = vi
    .fn<(request: RecordedRequest) => Promise<Response>>()
    .mockReturnValue(refresh.promise);
  api.setRoute("GET /api/v1/organization/", startRefresh);
  await act(async () => {
    await app.router.navigate({ to: "/settings" });
  });
  await screen.findByRole("heading", { name: "Configuración" });
  await act(async () => {
    await app.router.navigate({ to: "/settings/organization" });
  });
  expect(
    (await screen.findByRole<HTMLInputElement>("textbox", { name: "Zona horaria" })).value,
  ).toBe("UTC");
  expect(screen.getByText("Revisión vigente: 5")).toBeDefined();
  await waitFor(() => {
    expect(startRefresh).toHaveBeenCalledTimes(1);
  });
  const staleRead = startRefresh.mock.calls[0]?.[0];
  expect(staleRead?.signal.aborted).toBe(false);
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => {
    expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(2);
  });
  expect(
    api.requests.filter((request) => request.method === "PATCH").map(({ body }) => body),
  ).toMatchObject([
    { expected_revision: 4, timezone: "UTC" },
    { expected_revision: 5, timezone: "UTC" },
  ]);
  await waitFor(() => {
    expect(staleRead?.signal.aborted).toBe(true);
    expect(screen.getByRole("button", { name: "Guardar" }).getAttribute("aria-disabled")).toBe(
      "false",
    );
  });
  // A later navigation may start a valid read; it must not stand in for the cancelled one.
  const currentRefresh = deferredResponse();
  const startCurrentRefresh = vi
    .fn<(request: RecordedRequest) => Promise<Response>>()
    .mockReturnValue(currentRefresh.promise);
  api.setRoute("GET /api/v1/organization/", startCurrentRefresh);
  await act(async () => {
    await app.router.navigate({ to: "/settings" });
  });
  await screen.findByRole("heading", { name: "Configuración" });
  await act(async () => {
    await app.router.navigate({ to: "/settings/organization" });
  });
  await screen.findByRole("textbox", { name: "Zona horaria" });
  await waitFor(() => {
    expect(startCurrentRefresh).toHaveBeenCalledTimes(1);
  });
  expect(startCurrentRefresh.mock.calls[0]?.[0].signal.aborted).toBe(false);
  await act(async () => {
    refresh.resolve(Response.json(ORGANIZATION));
    await refresh.promise;
  });
  expect(screen.getByText("Revisión vigente: 5")).toBeDefined();
  expect(startCurrentRefresh.mock.calls[0]?.[0].signal.aborted).toBe(false);
  await act(async () => {
    currentRefresh.resolve(
      Response.json({ ...ORGANIZATION, revision: 5, timezone: "UTC", epi_week: "mmwr" }),
    );
    await currentRefresh.promise;
  });
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Zona horaria" }).value).toBe("UTC");
  expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(2);
});

test.each(["none", "selected"] as const)(
  "org-wide routes, links and queries need action codes even with center mode %s and no ids",
  async (mode) => {
    const me = {
      ...ME,
      permissions: ["organization.read", "role.read", "center.read"],
      scope: { centers: { mode, ids: [] }, quadrants: { mode: "none" as const, ids: [] } },
    };
    const { app, user, api } = await open("/settings/organization", me);
    await screen.findByRole("textbox", { name: "Zona horaria" });
    expect(screen.queryByRole("combobox", { name: "Filtro de centro" })).toBeNull();
    expect(api.requests.some((request) => request.path.startsWith("/api/v1/centers/"))).toBe(false);
    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
    await act(async () => {
      await app.router.navigate({ to: "/settings" });
    });
    expect(screen.getAllByRole("link", { name: "Configuración" }).length).toBeGreaterThan(0);
    const settings = within(screen.getByRole("main"));
    expect(
      settings.getByRole("link", { name: messages["es-MX"]["orgAdmin.organization.title"] }),
    ).toBeDefined();
    await user.click(
      settings.getByRole("link", { name: messages["es-MX"]["orgAdmin.roles.title"] }),
    );
    await screen.findByText("Equipo", { exact: true });
    expect(screen.queryByRole("heading", { name: "No tienes acceso a esta sección" })).toBeNull();
  },
);

test.each([
  {
    path: "/settings/organization",
    permission: "organization.read",
    endpoint: "/api/v1/organization/",
    title: "orgAdmin.organization.title",
  },
  {
    path: "/settings/roles",
    permission: "role.read",
    endpoint: "/api/v1/roles/",
    title: "orgAdmin.roles.title",
  },
] as const)(
  "$path denies a missing $permission before fetching and hides its settings link",
  async (scenario) => {
    const { api, app } = await open(scenario.path, {
      ...ME,
      permissions: ME.permissions.filter((permission) => permission !== scenario.permission),
      scope: { ...SCOPE, centers: { mode: "none", ids: [] } },
    });
    await screen.findByRole("heading", { name: "No tienes acceso a esta sección" });
    expect(api.requests.some((request) => request.path.startsWith(scenario.endpoint))).toBe(false);
    await act(async () => {
      await app.router.navigate({ to: "/settings" });
    });
    expect(
      within(screen.getByRole("main")).queryByRole("link", {
        name: messages["es-MX"][scenario.title],
      }),
    ).toBeNull();
  },
);

async function openPendingAdminWrite(kind: "role" | "membership" | "organization") {
  const setup = await open(kind === "organization" ? "/settings/organization" : "/settings/roles");
  const member = {
    id: "focus-member",
    user: ME.user.id,
    profiles: [ROLE.id],
    scope: SCOPE,
    is_active: true,
    revision: 6,
    created_at: "2026-11-01T00:00:00Z",
    created_by: null,
  };
  if (kind === "membership") {
    setup.api.setRoute("GET /api/v1/memberships/", () => Response.json(page([member])));
    await setup.user.selectOptions(
      await screen.findByRole("combobox", { name: "Vista" }),
      "memberships",
    );
    await setup.user.click(await screen.findByRole("button", { name: "Editar alcance" }));
  } else if (kind === "role")
    await setup.user.click(await screen.findByRole("button", { name: /^Equipo: role.update / }));
  else await screen.findByRole("textbox", { name: "Zona horaria" });
  const write = deferredResponse();
  const method = kind === "organization" ? "PATCH" : kind === "role" ? "PUT" : "POST";
  const endpoint =
    kind === "organization"
      ? "/api/v1/organization/"
      : kind === "role"
        ? `/api/v1/roles/${ROLE.id}/permissions/`
        : "/api/v1/memberships/focus-member/change-scope/";
  const reply =
    kind === "organization"
      ? { ...ORGANIZATION, revision: 5 }
      : kind === "role"
        ? { ...ROLE, revision: 4 }
        : { ...member, revision: 7 };
  setup.api.setRoute(`${method} ${endpoint}`, () => write.promise);
  return { ...setup, write, method, reply };
}

test.each([
  { kind: "role", hasPassiveError: false },
  { kind: "membership", hasPassiveError: false },
  { kind: "organization", hasPassiveError: false },
  { kind: "role", hasPassiveError: true },
] as const)(
  "a committed $kind write waits for focus verification and a fresh post-write identity (passive error: $hasPassiveError)",
  async ({ kind, hasPassiveError }) => {
    const { api, app, user, write, method, reply } = await openPendingAdminWrite(kind);
    const focus = deferredResponse();
    const passive = deferredResponse();
    const fresh = deferredResponse();
    const replies = [focus.promise, passive.promise, fresh.promise];
    api.setRoute("GET /api/v1/me/", () => {
      const next = replies.shift();
      if (!next) throw new Error("Unexpected identity request");
      return next;
    });
    let markPassiveSettled!: () => void;
    const passiveSettled = new Promise<void>((resolve) => {
      markPassiveSettled = resolve;
    });
    const original = meQuery.fetchMeCommitted;
    vi.spyOn(meQuery, "fetchMeCommitted").mockImplementation(async (deps, request) => {
      try {
        return await original(deps, request);
      } finally {
        if (!request?.token) markPassiveSettled();
      }
    });
    const client = app.router.options.context.client;
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => {
      expect(api.requests.some((request) => request.method === method)).toBe(true);
    });
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    const verifying = reconcileSession(app.queryClient, client, "verify");
    try {
      await waitFor(() => {
        expect(api.requests.filter((request) => request.path === "/api/v1/me/")).toHaveLength(2);
      });
      await act(async () => {
        write.resolve(Response.json(reply));
        await write.promise;
      });
      await waitFor(() => {
        expect(api.requests.filter((request) => request.path === "/api/v1/me/")).toHaveLength(3);
      });
      await act(async () => {
        passive.resolve(hasPassiveError ? apiError(503, "unavailable") : Response.json(ME));
        await passiveSettled;
      });
      expect(sessionState()).toBe("reconciling");
      await act(async () => {
        focus.resolve(Response.json(ME));
        await verifying;
      });
      await waitFor(() => {
        expect(api.requests.filter((request) => request.path === "/api/v1/me/")).toHaveLength(4);
      });
      const updated = { ...ME, organization: { ...ME.organization, name: "Fresh after write" } };
      await act(async () => {
        fresh.resolve(Response.json(updated));
        await fresh.promise;
      });
      await waitFor(() => {
        expect(isSessionKnown()).toBe(true);
      });
      await screen.findByText("Cambios guardados");
      if (kind !== "organization") expect(screen.queryByRole("dialog")).toBeNull();
      else
        await waitFor(() => {
          expect(
            screen.getByRole("button", { name: "Guardar" }).getAttribute("aria-disabled"),
          ).toBe("false");
        });
      expect(app.queryClient.getQueryData<typeof ME>(ME_QUERY_KEY)?.organization?.name).toBe(
        "Fresh after write",
      );
      expect(api.requests.filter((request) => request.method === method)).toHaveLength(1);
    } finally {
      await act(async () => {
        write.resolve(Response.json(reply));
        passive.resolve(Response.json(ME));
        focus.resolve(Response.json(ME));
        fresh.resolve(Response.json(ME));
        await verifying;
      });
    }
  },
);
