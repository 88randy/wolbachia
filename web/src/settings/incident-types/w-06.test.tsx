import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { axe } from "jest-axe";
import { apiError, createFakeApi, makeMe } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import { endSessionExpiry } from "../../session/session-events";
import { reconcileSession } from "../../session/session-reconcile";
import { W64_TYPE, W64_OWNERS, incidentTypePage } from "./w-06-fixtures";
import { invalidateTypes } from "./incident-types-query";
const ME = makeMe({ permissions: ["incident.manage_type"] });
function setup(terminalEligible = true) {
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(ME),
    "GET /api/v1/incident-types/": (request) => {
      const code = new URL(request.path, "http://localhost").searchParams.get("code");
      return Response.json(incidentTypePage(code && code !== W64_TYPE.code ? [] : [W64_TYPE]));
    },
    "GET /api/v1/incident-types/unconfigured-items/": () => Response.json(incidentTypePage([])),
    "GET /api/v1/incident-types/owner-options/": (request) => {
      const id = new URL(request.path, "http://localhost").searchParams.get("membership_id");
      return Response.json(
        incidentTypePage(
          W64_OWNERS.filter((owner) => !id || owner.membership_id === id).map((owner) => ({
            ...owner,
            is_terminal_eligible: terminalEligible && owner.is_terminal_eligible,
          })),
        ),
      );
    },
    [`GET /api/v1/incident-types/${W64_TYPE.id}/versions/`]: () =>
      Response.json(
        incidentTypePage([{ ...W64_TYPE, created_at: "2026-11-01T12:00:00Z", created_by: null }]),
      ),
    [`PATCH /api/v1/incident-types/${W64_TYPE.id}/`]: () =>
      Response.json({ ...W64_TYPE, revision: 3 }),
  });
  return api;
}
beforeEach(() => {
  endSessionExpiry();
  document.cookie = "csrftoken=test-csrf; path=/";
});
test("W64 discovers and explicitly configures real protected Other without synthetic policy", async () => {
  const api = setup();
  const user = userEvent.setup();
  let configured = false;
  const other = { id: W64_TYPE.id, code: "other", label: "Otro", icon: "alert", is_other: true };
  const saved = {
    ...W64_TYPE,
    ...other,
    revision: 1,
    severity: "high" as const,
    supervisor: null,
    coordinator: null,
    supervisor_display: null,
    coordinator_display: null,
    supervisor_sla_seconds: 1,
    coordinator_sla_seconds: 1,
    report_evidence_min: 0,
    close_evidence_min: 1,
    blocker_kinds: [],
  };
  api.setRoute("GET /api/v1/incident-types/", () =>
    Response.json(incidentTypePage(configured ? [saved] : [])),
  );
  api.setRoute("GET /api/v1/incident-types/unconfigured-items/", () =>
    Response.json(incidentTypePage(configured ? [] : [other])),
  );
  api.setRoute(`PATCH /api/v1/incident-types/${other.id}/`, () => {
    configured = true;
    return Response.json(saved);
  });
  const app = await renderApp({ path: "/settings/incident-types", fetch: api.fetch });
  await user.click(await screen.findByRole("button", { name: /^Otro$/ }));
  await waitFor(() => {
    expect(app.router.state.location.search).toHaveProperty("configure", "other");
  });
  const form = await screen.findByRole("form", { name: "Configuración del tipo" });
  expect(
    within(form).getByRole<HTMLSelectElement>("combobox", { name: "Severidad por defecto" }).value,
  ).toBe("");
  await user.selectOptions(within(form).getByLabelText("Severidad por defecto"), "high");
  await user.selectOptions(
    await within(form).findByRole("combobox", { name: "Responsable terminal" }),
    W64_OWNERS[2].membership_id,
  );
  for (const label of [
    "Respuesta del supervisor (segundos)",
    "Respuesta del coordinador (segundos)",
    "Fotos para cerrar",
  ])
    await user.type(within(form).getByLabelText(label), "1");
  await user.type(within(form).getByLabelText("Fotos para reportar"), "0");
  const save = within(form).getByRole("button", { name: "Guardar versión" });
  await waitFor(() => {
    expect(save.getAttribute("aria-disabled")).not.toBe("true");
  });
  await user.click(save);
  await screen.findByText("Versión guardada");
  const body = api.requests.find((request) => request.method === "PATCH")?.body;
  expect(body).toMatchObject({
    expected_revision: 0,
    severity: "high",
    terminal_id: W64_OWNERS[2].membership_id,
  });
  expect(body).not.toHaveProperty("label");
  expect(body).not.toHaveProperty("icon");
  expect(body).not.toHaveProperty("code");
});
test("W64 retains system-owned lot blockers when changing only the response deadline", async () => {
  const api = setup();
  const user = userEvent.setup();
  const biological = { ...W64_TYPE, blocker_kinds: ["lot_dispatch"] };
  api.setRoute("GET /api/v1/incident-types/", () => Response.json(incidentTypePage([biological])));
  api.setRoute(`PATCH /api/v1/incident-types/${W64_TYPE.id}/`, () =>
    Response.json({ ...biological, revision: 3, supervisor_sla_seconds: 1800 }),
  );
  await renderApp({ path: "/settings/incident-types?editor=unrecovered", fetch: api.fetch });
  await screen.findByText("lot_dispatch");
  expect(screen.queryByRole("checkbox", { name: "Cierre de cuadrante" })).toBeNull();
  const deadline = screen.getByLabelText("Respuesta del supervisor (segundos)");
  await user.clear(deadline);
  await user.type(deadline, "1800");
  const save = screen.getByRole("button", { name: "Guardar versión" });
  await waitFor(() => {
    expect(save.getAttribute("aria-disabled")).not.toBe("true");
  });
  await user.click(save);
  await screen.findByText("Versión guardada");
  const body = api.requests.find((request) => request.method === "PATCH")?.body;
  expect(body).toMatchObject({ expected_revision: 2, supervisor_sla_seconds: 1800 });
  expect(body).not.toHaveProperty("blocker_kinds");
  expect(screen.getByText("lot_dispatch")).toBeDefined();
});
afterEach(() => {
  vi.restoreAllMocks();
  endSessionExpiry();
  document.cookie = "csrftoken=; Max-Age=0; path=/";
});
test("W64 named chain, evidence and blockers roundtrip uses reviewed revision and history", async () => {
  const api = setup();
  await renderApp({ path: "/settings/incident-types?editor=unrecovered", fetch: api.fetch });
  const user = userEvent.setup();
  const form = await screen.findByRole("form", { name: "Configuración del tipo" });
  expect(
    (await within(form).findByRole<HTMLSelectElement>("combobox", { name: "Responsable terminal" }))
      .value,
  ).toBe(W64_OWNERS[2].membership_id);
  await user.clear(within(form).getByLabelText("Fotos para cerrar"));
  await user.type(within(form).getByLabelText("Fotos para cerrar"), "3");
  await user.click(within(form).getByRole("checkbox", { name: "Cierre de cuadrante" }));
  await user.click(within(form).getByRole("button", { name: "Guardar versión" }));
  await screen.findByText("Versión guardada");
  expect(api.requests.find((request) => request.method === "PATCH")?.body).toMatchObject({
    expected_revision: 2,
    terminal_id: W64_OWNERS[2].membership_id,
    close_evidence_min: 3,
    blocker_kinds: ["dispatch"],
    supervisor_sla_seconds: 3600,
  });
  await user.click(screen.getByRole("button", { name: "Historial de configuración" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Responsable de guardia")).toBeDefined();
  expect((await axe(dialog)).violations).toEqual([]);
  await user.keyboard("{Escape}");
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Historial de configuración" }),
  );
});
test("W64 missing eligible duty owner blocks save; protected Other cannot rename or deactivate", async () => {
  const api = setup(false);
  api.setRoute("GET /api/v1/incident-types/", () =>
    Response.json(
      incidentTypePage([{ ...W64_TYPE, code: "other", label: "Otro", is_other: true }]),
    ),
  );
  await renderApp({ path: "/settings/incident-types?editor=other", fetch: api.fetch });
  const form = await screen.findByRole("form", { name: "Configuración del tipo" });
  expect(within(form).getByLabelText("Nombre").hasAttribute("disabled")).toBe(true);
  expect(within(form).getByRole("switch", { name: "Tipo activo" }).hasAttribute("disabled")).toBe(
    true,
  );
  await screen.findByText(/Una persona administradora debe configurar un responsable terminal/);
  expect(
    within(form).getByRole("button", { name: "Guardar versión" }).getAttribute("aria-disabled"),
  ).toBe("true");
  expect(api.requests.some((request) => request.method === "PATCH")).toBe(false);
});
test("W64 coded refusal and revision conflict retain input until explicit current review", async () => {
  const api = setup();
  api.setRoute(`PATCH /api/v1/incident-types/${W64_TYPE.id}/`, () =>
    apiError(400, "validation_error", { fields: { icon: [{ code: "invalid" }] } }),
  );
  await renderApp({ path: "/settings/incident-types?editor=unrecovered", fetch: api.fetch });
  const user = userEvent.setup();
  const icon = await screen.findByLabelText("Ícono");
  await user.clear(icon);
  await user.type(icon, "trap");
  await user.click(screen.getByRole("button", { name: "Guardar versión" }));
  await screen.findByText("Revisa este campo y vuelve a guardar.");
  expect((icon as HTMLInputElement).value).toBe("trap");
  api.setRoute(`PATCH /api/v1/incident-types/${W64_TYPE.id}/`, () =>
    apiError(409, "incident_conflict"),
  );
  await user.click(screen.getByRole("button", { name: "Guardar versión" }));
  await screen.findByText(/La configuración cambió/);
  expect((icon as HTMLInputElement).value).toBe("trap");
  expect(
    screen.getByRole("button", { name: "Guardar versión" }).getAttribute("aria-disabled"),
  ).toBe("true");
  await user.click(screen.getByRole("button", { name: "Revisar configuración vigente" }));
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Guardar versión" }).getAttribute("aria-disabled"),
    ).not.toBe("true");
  });
});
test("W64 missing action and unknown codes deny access; changed scope removes private results", async () => {
  const api = setup();
  api.setRoute("GET /api/v1/me/", () => Response.json(makeMe({ permissions: [] })));
  const denied = await renderApp({
    path: "/settings/incident-types?editor=foreign",
    fetch: api.fetch,
  });
  await screen.findByRole("heading", { name: "No tienes acceso a esta sección" });
  expect(api.requests.some((request) => request.path.startsWith("/api/v1/incident-types/"))).toBe(
    false,
  );
  denied.unmount();
  api.setRoute("GET /api/v1/me/", () => Response.json(ME));
  const app = await renderApp({
    path: "/settings/incident-types?editor=unrecovered",
    fetch: api.fetch,
  });
  await screen.findByLabelText("Ícono");
  const changed = { ...ME, permissions: [] };
  api.setRoute("GET /api/v1/me/", () => Response.json(changed));
  await act(async () => {
    await reconcileSession(app.queryClient, app.router.options.context.client);
    await app.router.invalidate();
  });
  await screen.findByRole("heading", { name: "No tienes acceso a esta sección" });
  expect(screen.queryByLabelText("Ícono")).toBeNull();
});
test("W64 unknown and foreign human codes share one unavailable editor", async () => {
  for (const code of ["unknown", "foreign"]) {
    const api = setup();
    const app = await renderApp({
      path: `/settings/incident-types?editor=${code}`,
      fetch: api.fetch,
    });
    await screen.findByText("No encontramos lo que buscas. Regresa e inténtalo de nuevo.");
    expect(screen.queryByRole("form", { name: "Configuración del tipo" })).toBeNull();
    app.unmount();
  }
});
test("W64 retains draft on transient refresh failure and retires it on definitive target denial", async () => {
  const api = setup();
  const user = userEvent.setup();
  let failure = 0;
  api.setRoute("GET /api/v1/incident-types/", (request) => {
    const code = new URL(request.path, "http://localhost").searchParams.get("code");
    return code && failure
      ? apiError(failure, failure === 403 ? "permission_denied" : "server_error")
      : Response.json(incidentTypePage([W64_TYPE]));
  });
  const app = await renderApp({
    path: "/settings/incident-types?editor=unrecovered",
    fetch: api.fetch,
  });
  const icon = await screen.findByLabelText<HTMLInputElement>("Ícono");
  await user.clear(icon);
  await user.type(icon, "private-draft");
  failure = 503;
  await act(async () => {
    await invalidateTypes(app.queryClient);
  });
  expect(screen.getByLabelText<HTMLInputElement>("Ícono").value).toBe("private-draft");
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Guardar versión" }).getAttribute("aria-disabled"),
    ).toBe("true");
  });
  failure = 403;
  await act(async () => {
    await invalidateTypes(app.queryClient);
  });
  await waitFor(() => {
    expect(screen.queryByLabelText("Ícono")).toBeNull();
  });
  failure = 0;
  await user.click(screen.getByRole("button", { name: "Reintentar" }));
  expect((await screen.findByLabelText<HTMLInputElement>("Ícono")).value).toBe("trap");
});
test("W64 reauthentication retains draft and releases a stale attempt without replay or stale unlocking", async () => {
  const api = setup();
  let releaseOld!: (reply: Response) => void;
  let releaseNew!: (reply: Response) => void;
  const old = new Promise<Response>((resolve) => {
    releaseOld = resolve;
  });
  const newer = new Promise<Response>((resolve) => {
    releaseNew = resolve;
  });
  let writes = 0;
  api.setRoute(`PATCH /api/v1/incident-types/${W64_TYPE.id}/`, () =>
    ++writes === 1 ? old : newer,
  );
  const app = await renderApp({
    path: "/settings/incident-types?editor=unrecovered",
    fetch: api.fetch,
  });
  const user = userEvent.setup();
  const icon = await screen.findByLabelText("Ícono");
  await user.clear(icon);
  await user.type(icon, "retained");
  const save = screen.getByRole("button", { name: "Guardar versión" });
  await waitFor(() => {
    expect(save.getAttribute("aria-disabled")).not.toBe("true");
  });
  await user.click(save);
  await waitFor(() => {
    expect(writes).toBe(1);
  });
  await act(async () => {
    await reconcileSession(app.queryClient, app.router.options.context.client);
    await app.router.invalidate();
  });
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Guardar versión" }).getAttribute("aria-disabled"),
    ).not.toBe("true");
  });
  expect(writes).toBe(1);
  expect(screen.getByLabelText<HTMLInputElement>("Ícono").value).toBe("retained");
  await user.click(screen.getByRole("button", { name: "Guardar versión" }));
  await waitFor(() => {
    expect(writes).toBe(2);
  });
  await act(async () => {
    releaseOld(apiError(409, "incident_conflict"));
    await old;
  });
  expect(screen.getByRole("button", { name: "Guardar versión" }).getAttribute("aria-busy")).toBe(
    "true",
  );
  await user.click(screen.getByRole("button", { name: "Guardar versión" }));
  expect(writes).toBe(2);
  await act(async () => {
    releaseNew(Response.json({ ...W64_TYPE, revision: 3 }));
    await newer;
  });
  await screen.findByText("Versión guardada");
});
