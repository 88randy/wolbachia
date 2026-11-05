import type { Profile } from "./use-w-03";
import { isSessionKnown } from "../../session/session-revision";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { endSessionExpiry } from "../../session/session-events";
import { ME_QUERY_KEY } from "../../session/me-key";
import { centerStorageKey, writeCenter } from "../../centers/center-selection";
import { fakePassword } from "../../test/fake-credentials";
import { apiError, createFakeApi, makeMe, makeOrganization } from "../../test/fake-api";
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
    "PATCH /api/v1/organization/": Response.json({
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
    const cell = await screen.findByRole("button", { name: "Equipo: role.update" });
    cell.focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Equipo dos: role.update" }),
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
    expect(screen.queryByRole("button", { name: "Consulta: role.update" })).toBeNull();
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
  test("empty center scope denies a settings deep link before requesting sensitive content", async () => {
    const { api } = await open("/settings/roles", {
      ...ME,
      scope: { ...SCOPE, centers: { mode: "selected", ids: [] } },
    });
    expect(
      await screen.findByRole("heading", { name: "No tienes acceso a esta sección" }),
    ).toBeDefined();
    expect(api.requests.some((request) => request.path.includes("roles"))).toBe(false);
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
  await user.click(await screen.findByRole("button", { name: "Equipo: role.update" }));
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
  await user.click(await screen.findByRole("button", { name: "Equipo: role.update" }));
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

test("a same-organization scope revocation clears old query results and denies the open deep link", async () => {
  const { api, app } = await open();
  await screen.findByRole("button", { name: "Equipo: role.update" });
  api.setRoute("GET /api/v1/me/", () =>
    Response.json({ ...ME, scope: { ...SCOPE, centers: { mode: "none", ids: [] } } }),
  );
  await act(async () => {
    await app.queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
  });
  await screen.findByRole("heading", { name: "No tienes acceso a esta sección" });
  expect(screen.queryByRole("button", { name: "Equipo: role.update" })).toBeNull();
  expect(
    app.queryClient
      .getQueriesData({
        predicate: (query) => query.queryKey[0] === "org" && query.queryKey[3] === "administration",
      })
      .every(([, result]) => result === undefined),
  ).toBe(true);
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
  await user.click(await screen.findByRole("button", { name: "Equipo: role.update" }));
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
async function openScopeSearch() {
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
  await context.user.click(await screen.findByRole("button", { name: "Equipo: role.update" }));
  const centers = within(screen.getByRole("group", { name: "Centros" }));
  await centers.findByRole("button", { name: /Quitar referencia: C-A/ });
  await context.user.click(centers.getByRole("textbox"));
  await context.user.paste("C-B");
  await context.user.click(centers.getByRole("button", { name: "Agregar código" }));
  await waitFor(() => {
    expect(context.api.requests.some((request) => request.path.includes("code=C-B"))).toBe(true);
  });
  return { ...context, lookup, centers, dialog: within(screen.getByRole("dialog")) };
}

test("a pending scope search blocks save and merges into the current draft without restoring removed references", async () => {
  const { api, user, lookup, centers, dialog } = await openScopeSearch();
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
    lookup.resolve(Response.json(page([CENTER_B])));
    await lookup.promise;
  });
  await centers.findByRole("button", { name: /Quitar referencia: C-B/ });
  expect(centers.queryByRole("button", { name: /Quitar referencia: C-A/ })).toBeNull();
  await user.click(dialog.getByRole("button", { name: "Guardar" }));
  await screen.findByText(/Debe permanecer al menos una persona administradora/);
  expect(api.requests.find((request) => request.method === "PUT")?.body).toEqual({
    permissions: ROLE.permissions,
    expected_revision: 3,
    scope: {
      centers: { mode: "selected", ids: [CENTER_B.id] },
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
  await user.click(await screen.findByRole("button", { name: "Equipo: motorcycle.unblock" }));
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
  api.setRoute("GET /api/v1/organization/", () => refresh.promise);
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
  await user.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => {
    expect(api.requests.filter((request) => request.method === "PATCH")).toHaveLength(2);
  });
  expect(api.requests.filter((request) => request.method === "PATCH")[1]?.body).toMatchObject({
    expected_revision: 5,
    timezone: "UTC",
  });
  await waitFor(() => {
    expect(
      api.requests
        .filter((request) => request.path === "/api/v1/organization/" && request.method === "GET")
        .at(-1)?.signal.aborted,
    ).toBe(true);
  });
  await act(async () => {
    refresh.resolve(Response.json(ORGANIZATION));
    await refresh.promise;
  });
  expect(screen.getByText("Revisión vigente: 5")).toBeDefined();
});
