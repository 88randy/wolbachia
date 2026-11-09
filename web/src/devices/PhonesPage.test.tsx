import { screen, waitFor, within } from "@testing-library/react";
import { ApiError } from "@wolbachia/api-client";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, test, vi } from "vitest";
import { createWebApiClient } from "../api/create-web-api-client";
import { ME_QUERY_KEY } from "../session/me-query";
import { switchOrganization } from "../session/organization-switch";
import { sessionState, subscribeToRevision } from "../session/session-revision";
import { simulateLogin } from "../test/simulate-session";
import { apiError, createFakeApi, makeMe, makeOrganization } from "../test/fake-api";
import type { RecordedRequest } from "../test/fake-api";
import { fakePassword } from "../test/fake-credentials";
import { renderApp } from "../test/render-app";
import type { Phone } from "./phones-query";

const ME = "GET /api/v1/me/";
const DEVICES = "GET /api/v1/devices/";
const PHONES = "/settings/phones";
const ALLOWED = makeMe({ permissions: ["device.read"] });

function phone(overrides: Partial<Phone> = {}): Phone {
  return {
    id: "6b1f0d5e-0a43-4c19-8c0e-3d0f7f0a0001",
    label: "Teléfono de Luis",
    serial: "SN-0001",
    app_version: "1.4.0",
    last_seen_at: "2026-11-04T03:30:00Z",
    last_user: "5f5c4c3e-4a0e-4a64-9a60-1a2b3c4d5e01",
    last_user_username: "luis",
    is_revoked: false,
    revoked_at: null,
    revoked_by: null,
    created_at: "2026-10-01T15:00:00Z",
    ...overrides,
  };
}

function pageOf(results: Phone[], count = results.length): Response {
  return Response.json({ count, next: null, previous: null, results });
}

function queryOf(request: RecordedRequest): URLSearchParams {
  return new URL(request.path, "http://x").searchParams;
}

function open(
  reply: Response | ((request: RecordedRequest) => Response | Promise<Response>),
  path = PHONES,
  me = ALLOWED,
) {
  const api = createFakeApi({ [ME]: Response.json(me), [DEVICES]: reply });
  return renderApp({ path, fetch: api.fetch, me }).then((app) => ({ api, app }));
}

const devicesRequests = (api: { requests: RecordedRequest[] }) =>
  api.requests.filter((request) => request.path.startsWith("/api/v1/devices/"));

/** What another tab does when it signs in: it announces the change on the shared channel. */
function announceFromAnotherTab(): void {
  const otherTab = new BroadcastChannel("wolbachia.session");
  otherTab.postMessage("changed");
  otherTab.close();
}

describe("phones list (W67)", () => {
  test("shows the phones read from GET /devices/, with the date in the organization's time zone", async () => {
    const { api } = await open(
      pageOf([
        phone(),
        phone({
          id: "2",
          label: "Teléfono de Rosa",
          last_user_username: null,
          last_seen_at: null,
          is_revoked: true,
        }),
      ]),
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Teléfonos" })).toBeDefined();
    const luis = await screen.findByRole("row", { name: /Teléfono de Luis/ });
    expect(within(luis).getByText("luis")).toBeDefined();
    expect(within(luis).getByText("1.4.0")).toBeDefined();
    expect(within(luis).getByText(/3 nov 2026/)).toBeDefined();
    expect(within(luis).getByText("Activo")).toBeDefined();
    const rosa = screen.getByRole("row", { name: /Teléfono de Rosa/ });
    expect(within(rosa).getByText("Sin usuario")).toBeDefined();
    expect(within(rosa).getByText("Nunca")).toBeDefined();
    expect(within(rosa).getByText("Revocado")).toBeDefined();
    const query = queryOf(devicesRequests(api)[0] as RecordedRequest);
    expect(Object.fromEntries(query)).toEqual({ page: "1", page_size: "25" });
  });

  test("is read only: no revoke, upload or version controls", async () => {
    await open(pageOf([phone()]));
    await screen.findByRole("row", { name: /Teléfono de Luis/ });

    expect(screen.queryByRole("button", { name: /revoc|subir|publicar/i })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /Seleccionar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Exportar" })).toBeNull();
  });

  test("a user without device.read gets the no-permission state and no request", async () => {
    const { api } = await open(
      pageOf([phone()]),
      PHONES,
      makeMe({ permissions: ["catalog.read"] }),
    );

    expect(
      await screen.findByRole("heading", { name: "No tienes acceso a esta sección" }),
    ).toBeDefined();
    expect(devicesRequests(api)).toHaveLength(0);
  });

  test("the status filter sends is_revoked and is kept in the URL", async () => {
    const user = userEvent.setup();
    const { api, app } = await open(pageOf([phone()]));
    await screen.findByRole("row", { name: /Teléfono de Luis/ });

    await user.selectOptions(screen.getByRole("combobox", { name: "Estado" }), "Revocado");

    await waitFor(() => {
      expect(app.router.state.location.search).toEqual({ is_revoked: "true" });
    });
    await waitFor(() => {
      expect(devicesRequests(api).map((request) => queryOf(request).get("is_revoked"))).toContain(
        "true",
      );
    });
    expect(screen.getByRole("button", { name: "Quitar filtro Estado: Revocado" })).toBeDefined();
  });

  test("shared address forwards paging, search, status, current-user sessions and visible version ordering", async () => {
    const { api } = await open(
      pageOf([phone()], 60),
      `${PHONES}?page=2&is_revoked=false&search=Luis&user=${ALLOWED.user.id}&ordering=-app_version`,
    );

    expect(await screen.findByText("Página 2 de 3")).toBeDefined();
    expect(screen.getByRole("button", { name: "Quitar filtro Estado: Activo" })).toBeDefined();
    const query = queryOf(devicesRequests(api)[0] as RecordedRequest);
    expect(Object.fromEntries(query)).toEqual({
      page: "2",
      page_size: "25",
      is_revoked: "false",
      search: "Luis",
      user: ALLOWED.user.id,
      ordering: "-app_version",
    });
    expect(screen.getByRole("columnheader", { name: /Versión/ }).getAttribute("aria-sort")).toBe(
      "descending",
    );
  });

  test("a parameter the list does not know is never sent and is announced", async () => {
    const { api } = await open(pageOf([phone()]), `${PHONES}?organization_id=abc&sort=version`);

    expect(await screen.findByText(/no se aplicaron: organization_id, sort/)).toBeDefined();
    const query = queryOf(devicesRequests(api)[0] as RecordedRequest);
    expect(Object.fromEntries(query)).toEqual({ page: "1", page_size: "25" });
  });

  test("shows the first-load state, then the rows, without a timer", async () => {
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    await open(() => pending);

    expect(await screen.findByText("Cargando resultados")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
    release(pageOf([phone()]));

    expect(await screen.findByRole("row", { name: /Teléfono de Luis/ })).toBeDefined();
  });

  test("an empty organization says there are no phones yet", async () => {
    await open(pageOf([]));

    expect(await screen.findByText("Aquí todavía no hay registros")).toBeDefined();
  });

  test("a failure is an alert and Retry asks again", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const { api } = await open(() => {
      attempts += 1;
      return attempts === 1 ? apiError(500, "server_error") : pageOf([phone()]);
    });

    expect((await screen.findByRole("alert")).textContent).toContain("Algo falló de nuestro lado");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("row", { name: /Teléfono de Luis/ })).toBeDefined();
    expect(devicesRequests(api)).toHaveLength(2);
  });

  test("after an identity change the new organization's pending request never shows the old rows (#82)", async () => {
    const { api, app } = await open(pageOf([phone({ label: "Teléfono de Norte" })]));
    await screen.findByRole("row", { name: /Teléfono de Norte/ });
    let release: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    api.setRoute(ME, Response.json({ ...ALLOWED, organization: makeOrganization("sur", "Sur") }));
    api.setRoute(DEVICES, () => pending);

    await app.queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });

    expect(await screen.findByText("Cargando resultados")).toBeDefined();
    expect(screen.queryByText("Teléfono de Norte")).toBeNull();
    release(pageOf([phone({ label: "Teléfono de Sur" })]));
    expect(await screen.findByRole("row", { name: /Teléfono de Sur/ })).toBeDefined();
  });

  test("an initial request pending across a same-user re-authentication is asked again, not left pending (#82)", async () => {
    let release: (response: Response) => void = () => undefined;
    const first = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let call = 0;
    await open(() => {
      call += 1;
      return call === 1 ? first : pageOf([phone({ label: "Teléfono de Luis" })]);
    });
    await screen.findByText("Cargando resultados");

    simulateLogin();
    release(pageOf([phone({ label: "Teléfono VIEJO" })]));

    expect(await screen.findByRole("row", { name: /Teléfono de Luis/ })).toBeDefined();
    expect(screen.queryByText("Teléfono VIEJO")).toBeNull();
    expect(call).toBe(2);
  });

  test("if /me/ fails while reconciling the tab blocks, never falls back to the old identity, and retry recovers (#82)", async () => {
    const user = userEvent.setup();
    const { api } = await open(pageOf([phone({ label: "Teléfono de Norte" })]));
    await screen.findByRole("row", { name: /Teléfono de Norte/ });
    api.setRoute(ME, apiError(503, "server_error"));

    announceFromAnotherTab();

    expect(await screen.findByText("No pudimos verificar tu sesión")).toBeDefined();
    // The page stays mounted (drafts are kept) but inert, and nothing is asked in this state.
    expect(screen.getByRole("main", { hidden: true }).hasAttribute("inert")).toBe(true);
    expect(devicesRequests(api)).toHaveLength(1);
    const requestsBefore = devicesRequests(api).length;
    api.setRoute(ME, Response.json(ALLOWED));
    api.setRoute(DEVICES, pageOf([phone({ label: "Teléfono de Sur" })]));
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("row", { name: /Teléfono de Sur/ })).toBeDefined();
    expect(screen.queryByText("No pudimos verificar tu sesión")).toBeNull();
    expect(requestsBefore).toBe(1);
  });

  test("a tab that missed the broadcast reconciles on focus: blocked until /me/ answers, then the new identity's data (#82)", async () => {
    const newMe = (() => {
      let release: (response: Response) => void = () => undefined;
      const promise = new Promise<Response>((resolve) => {
        release = resolve;
      });
      return { promise, release };
    })();
    const { api } = await open(pageOf([phone({ label: "Teléfono de Norte" })]));
    await screen.findByRole("row", { name: /Teléfono de Norte/ });
    api.setRoute(ME, () => newMe.promise);
    api.setRoute(DEVICES, pageOf([phone({ label: "Teléfono de Sur" })]));

    window.dispatchEvent(new Event("focus"));

    expect(await screen.findByText("Verificando tu sesión…")).toBeDefined();
    expect(screen.getByRole("main", { hidden: true }).hasAttribute("inert")).toBe(true);
    expect(devicesRequests(api)).toHaveLength(1);
    newMe.release(Response.json({ ...ALLOWED, organization: makeOrganization("sur", "Sur") }));

    expect(await screen.findByRole("row", { name: /Teléfono de Sur/ })).toBeDefined();
    expect(screen.queryByText("Verificando tu sesión…")).toBeNull();
    expect(screen.getByRole("main").hasAttribute("inert")).toBe(false);
  });

  test("a late answer sent with the old cookie never survives a failed session check and a re-authentication (#82)", async () => {
    const user = userEvent.setup();
    document.cookie = "csrftoken=test-csrf; path=/";
    let release: (response: Response) => void = () => undefined;
    const late = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let call = 0;
    const { api, app } = await open(() => {
      call += 1;
      return call === 1 ? late : pageOf([phone({ label: "Teléfono de A" })]);
    });
    await screen.findByText("Cargando resultados");

    // A broadcast was missed; B signed out meanwhile, so on focus /me/ answers 401.
    api.setRoute(ME, apiError(401, "not_authenticated"));
    window.dispatchEvent(new Event("focus"));
    await screen.findByRole("dialog", { name: "Tu sesión terminó" });
    release(pageOf([phone({ label: "Teléfono de B" })]));
    await new Promise<void>((resolve) => {
      const hop = new MessageChannel();
      hop.port1.onmessage = () => {
        resolve();
      };
      hop.port2.postMessage(0);
    });
    // B's answer was sent with the old cookie: it must not be stored, not even while unknown.
    const stored = app.queryClient
      .getQueryCache()
      .findAll({ predicate: (query) => query.queryKey[0] === "org" })
      .filter((query) => query.state.data !== undefined);
    expect(stored).toEqual([]);

    api.setRoute(ME, Response.json(ALLOWED));
    api.setRoute("GET /api/v1/auth/csrf/", new Response(null, { status: 204 }));
    api.setRoute(
      "POST /api/v1/auth/login/",
      Response.json({ me: ALLOWED, server_time: "2026-11-04T12:00:00Z" }),
    );
    await user.type(screen.getByLabelText("Contraseña"), fakePassword());
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("row", { name: /Teléfono de A/ })).toBeDefined();
    expect(screen.queryByText("Teléfono de B")).toBeNull();
  });

  test("the blocker is a modal dialog opened last, so it covers a content dialog that was open (#82)", async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    const { api } = await open(pageOf([phone()]));
    await screen.findByRole("row", { name: /Teléfono de Luis/ });
    const content = document.createElement("dialog");
    document.body.append(content);
    content.showModal();
    api.setRoute(ME, apiError(503, "server_error"));

    window.dispatchEvent(new Event("focus"));
    await screen.findByText("No pudimos verificar tu sesión");

    const blocker = screen.getByText("No pudimos verificar tu sesión").closest("dialog");
    expect(blocker).not.toBe(content);
    expect(showModal.mock.contexts.at(-1)).toBe(blocker);
    showModal.mockRestore();
    content.remove();
  });

  test("a resource 401 leaves known through the one transition: the late answer of the other cookie is dropped and a same-identity re-auth shows no B data (#82)", async () => {
    const user = userEvent.setup();
    document.cookie = "csrftoken=test-csrf; path=/";
    const deferred = () => {
      let release: (response: Response) => void = () => undefined;
      const promise = new Promise<Response>((resolve) => {
        release = resolve;
      });
      return { promise, release };
    };
    const late = deferred();
    const refetch = deferred();
    let call = 0;
    const { api, app } = await open(() => {
      call += 1;
      if (call === 1) return late.promise;
      return call === 2 ? refetch.promise : pageOf([phone({ label: "Teléfono de A" })]);
    });
    await screen.findByText("Cargando resultados");

    // Another resource answers 401 (B signed out): no /me/ check, no focus, only the 401.
    await app.queryClient
      .query({ queryKey: ["probe"], queryFn: () => Promise.reject(new ApiError(401)) })
      .catch(() => undefined);
    await screen.findByRole("dialog", { name: "Tu sesión terminó" });
    late.release(pageOf([phone({ label: "Teléfono de B" })]));
    await new Promise<void>((resolve) => {
      const hop = new MessageChannel();
      hop.port1.onmessage = () => {
        resolve();
      };
      hop.port2.postMessage(0);
    });
    const stored = app.queryClient
      .getQueryCache()
      .findAll({ predicate: (query) => query.queryKey[0] === "org" })
      .filter((query) => query.state.data !== undefined);
    expect(stored).toEqual([]);

    api.setRoute("GET /api/v1/auth/csrf/", new Response(null, { status: 204 }));
    api.setRoute(
      "POST /api/v1/auth/login/",
      Response.json({ me: ALLOWED, server_time: "2026-11-04T12:00:00Z" }),
    );
    await user.type(screen.getByLabelText("Contraseña"), fakePassword());
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => {
      expect(call).toBe(2);
    });
    expect(screen.queryByText("Teléfono de B")).toBeNull();
    refetch.release(pageOf([phone({ label: "Teléfono de A" })]));

    expect(await screen.findByRole("row", { name: /Teléfono de A/ })).toBeDefined();
    expect(screen.queryByText("Teléfono de B")).toBeNull();
  });

  test("a response attested for another identity is discarded, leaves known and the tab reconciles (#82)", async () => {
    const attested = (id: string) => ({ headers: { "X-Session-Identity": id } });
    let devices = 0;
    let meCalls = 0;
    const api = createFakeApi({
      [ME]: () => {
        meCalls += 1;
        return Response.json(ALLOWED, attested("identity-A"));
      },
      [DEVICES]: () => {
        devices += 1;
        // The first answer was produced for another session (another tab signed in as B).
        return devices === 1
          ? Response.json(
              {
                count: 1,
                next: null,
                previous: null,
                results: [phone({ label: "Teléfono de B" })],
              },
              attested("identity-B"),
            )
          : Response.json(
              {
                count: 1,
                next: null,
                previous: null,
                results: [phone({ label: "Teléfono de A" })],
              },
              attested("identity-A"),
            );
      },
    });
    const states: string[] = [];
    const stop = subscribeToRevision(() => states.push(sessionState()));

    await renderApp({ path: PHONES, fetch: api.fetch, me: ALLOWED });

    expect(await screen.findByRole("row", { name: /Teléfono de A/ })).toBeDefined();
    expect(screen.queryByText("Teléfono de B")).toBeNull();
    expect(meCalls).toBeGreaterThan(1); // it reconciled: /me/ was asked again
    expect(states).toContain("unknown"); // and it left `known` through the one transition
    stop();
  });

  test("switching organization is a leave-known transition: with the new /me/ held, Back to the old screen fetches and stores nothing (#82)", async () => {
    let releaseMe: (response: Response) => void = () => undefined;
    const meOfSur = new Promise<Response>((resolve) => {
      releaseMe = resolve;
    });
    const { api, app } = await open(pageOf([phone({ label: "Teléfono de Norte" })]));
    await screen.findByRole("row", { name: /Teléfono de Norte/ });
    const requestsBefore = devicesRequests(api).length;
    api.setRoute(ME, () => meOfSur);
    const client = createWebApiClient({ apiBaseUrl: "/api/v1" }, { fetch: api.fetch });

    const switching = switchOrganization(app.queryClient, client, "sur");
    expect(sessionState()).toBe("reconciling"); // entered synchronously, before anything else
    // The guards wait for the verified identity (the stale `/me/` is not trusted): navigation
    // stays pending, and Back to the screen of the old organization fetches nothing either.
    void app.router.navigate({ to: "/settings" });
    app.router.history.back();
    await new Promise<void>((resolve) => {
      const hop = new MessageChannel();
      hop.port1.onmessage = () => {
        resolve();
      };
      hop.port2.postMessage(0);
    });

    const stored = () =>
      app.queryClient
        .getQueryCache()
        .findAll({ predicate: (query) => query.queryKey[0] === "org" })
        .filter((query) => query.state.data !== undefined);
    expect(devicesRequests(api)).toHaveLength(requestsBefore); // nothing fetched
    expect(stored()).toEqual([]); // nothing stored
    api.setRoute(DEVICES, pageOf([phone({ label: "Teléfono de Sur" })]));
    releaseMe(
      Response.json({ ...ALLOWED, organization: makeOrganization("sur", "Sur") }, { status: 200 }),
    );
    await switching;

    await app.router.navigate({ to: PHONES });
    expect(await screen.findByRole("row", { name: /Teléfono de Sur/ })).toBeDefined();
    expect(stored().map((query) => query.queryKey[2])).toEqual(["sur"]);
  });

  test("another tab signs in as someone else while this tab pages: no old rows, and the late answer is dropped (#82)", async () => {
    const user = userEvent.setup();
    const deferred = () => {
      let release: (response: Response) => void = () => undefined;
      const promise = new Promise<Response>((resolve) => {
        release = resolve;
      });
      return { promise, release };
    };
    const latePage = deferred();
    const newMe = deferred();
    const replies = [
      pageOf([phone({ label: "Teléfono de Norte" })], 60),
      () => latePage.promise,
      () => pageOf([phone({ label: "Teléfono de Sur" })], 1),
    ];
    let call = 0;
    const { api } = await open(() => {
      const reply = replies[call];
      call += 1;
      return typeof reply === "function" ? reply() : (reply as Response).clone();
    });
    await screen.findByRole("row", { name: /Teléfono de Norte/ });
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => {
      expect(call).toBe(2);
    });
    api.setRoute(ME, () => newMe.promise);

    announceFromAnotherTab();

    expect(await screen.findByText("Cargando resultados")).toBeDefined();
    expect(screen.queryByText("Teléfono de Norte")).toBeNull();
    latePage.release(pageOf([phone({ label: "Teléfono TARDE" })], 60));
    newMe.release(Response.json({ ...ALLOWED, organization: makeOrganization("sur", "Sur") }));

    expect(await screen.findByRole("row", { name: /Teléfono de Sur/ })).toBeDefined();
    expect(screen.queryByText("Teléfono TARDE")).toBeNull();
    expect(screen.queryByText("Teléfono de Norte")).toBeNull();
  });

  test("is in English when the language is English", async () => {
    const api = createFakeApi({ [ME]: Response.json(ALLOWED), [DEVICES]: pageOf([phone()]) });
    await renderApp({ path: PHONES, fetch: api.fetch, language: "en" });

    expect(await screen.findByRole("heading", { level: 1, name: "Phones" })).toBeDefined();
    expect(await screen.findByRole("columnheader", { name: "Last seen" })).toBeDefined();
    expect(await screen.findByText(/Nov 3, 2026/)).toBeDefined();
  });

  test("has no axe violations", async () => {
    const { app } = await open(
      pageOf([phone(), phone({ id: "2", label: "Teléfono de Rosa", is_revoked: true })]),
    );
    await screen.findByRole("row", { name: /Teléfono de Luis/ });

    expect(await axe(app.container)).toHaveNoViolations();
  });
});

describe("settings home links", () => {
  test("links to the phones list when the user may read devices", async () => {
    await open(pageOf([]), "/settings");

    const link = await screen.findByRole("link", { name: "Teléfonos" });

    expect(link.getAttribute("href")).toBe(PHONES);
  });

  test("hides the link from a user who may not", async () => {
    await open(pageOf([]), "/settings", makeMe({ permissions: ["catalog.read"] }));
    await screen.findByRole("heading", { level: 1, name: "Configuración" });

    expect(screen.queryByRole("link", { name: "Teléfonos" })).toBeNull();
  });
});
