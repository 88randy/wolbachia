import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { makeMe, makeOrganization, apiError } from "../test/fake-api";
import { fakePassword } from "../test/fake-credentials";
import {
  ALLOWED,
  GET,
  LIST,
  motorcycle,
  openFleet,
  pageOf,
  motorcycleDetail,
  serviceRecord,
  fleetFault,
  evidenceFile,
  historyPage,
  settleFleet,
} from "./fleet-test-helpers";
import { observeFleetBody } from "../test/fleet-read-test-helpers";
import { currentRevision } from "../session/session-revision";

function deferred<T = Response>() {
  let release: (reply: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("fleet session isolation", () => {
  test.each(["expired", "lost"] as const)(
    "a %s service reply preserves its capture without automatic replay",
    async (outcome) => {
      const path = `/api/v1/motorcycles/${motorcycle().id}/services/`;
      let attempts = 0;
      const currentDetail = deferred<undefined>();
      const { api, app, reads } = await openFleet({
        path: `${LIST}/M-03`,
        routes: {
          [`GET /api/v1/motorcycles/${motorcycle().id}/`]: async () => {
            if (outcome === "expired" && attempts > 0) await currentDetail.promise;
            return Response.json(motorcycleDetail());
          },
          [`POST ${path}`]: () => {
            if (++attempts > 1) return Response.json(serviceRecord(), { status: 201 });
            if (outcome === "expired") return apiError(401, "not_authenticated");
            throw new TypeError("Synthetic lost service reply");
          },
          "POST /api/v1/auth/login/": Response.json({
            me: ALLOWED,
            server_time: "2026-11-04T12:00:00Z",
          }),
        },
      });
      document.cookie = "csrftoken=synthetic-csrf; path=/";
      await userEvent.click(await screen.findByRole("button", { name: "Registrar servicio" }));
      let dialog = within(screen.getByRole("dialog"));
      await userEvent.selectOptions(dialog.getByRole("combobox"), "inspection");
      await userEvent.type(dialog.getByLabelText("Fecha del servicio"), "2026-11-01");
      await userEvent.type(dialog.getByRole("spinbutton", { name: "Odómetro (km)" }), "12600");
      await userEvent.click(dialog.getByRole("textbox", { name: "Observaciones" }));
      await userEvent.paste("Private retained service attempt");
      const beforeAttempt = reads.length;
      await userEvent.click(dialog.getByRole("button", { name: "Registrar servicio" }));
      if (outcome === "expired") {
        await userEvent.click(await screen.findByLabelText("Contraseña"));
        await userEvent.paste(fakePassword());
        expect(screen.queryByRole("textbox", { name: "Observaciones" })).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
        await waitFor(() => {
          expect(screen.queryByLabelText("Contraseña")).toBeNull();
        });
        await act(async () => {
          await app.queryClient.refetchQueries({ queryKey: ["me"] });
        });
        await waitFor(() => {
          expect(
            reads
              .slice(beforeAttempt)
              .some(
                (read) =>
                  read.revision === currentRevision() &&
                  !read.request.signal.aborted &&
                  new URL(read.request.url).pathname ===
                    `/api/v1/motorcycles/${motorcycle().id}/` &&
                  !read.response,
              ),
          ).toBe(true);
        });
        expect(screen.queryByRole("textbox", { name: "Observaciones" })).toBeNull();
        expect(attempts).toBe(1);
        act(() => {
          currentDetail.release(undefined);
        });
        await settleFleet({ api, app, reads }, { since: beforeAttempt });
      }
      const notes = await within(screen.getByRole("main")).findByRole<HTMLTextAreaElement>(
        "textbox",
        {
          name: "Observaciones",
        },
      );
      expect(notes.value).toBe("Private retained service attempt");
      dialog = within(screen.getByRole("dialog"));
      expect(attempts).toBe(1);
      if (outcome === "lost") {
        expect(
          dialog.getByRole("button", { name: "Registrar servicio" }).getAttribute("aria-disabled"),
        ).toBe("true");
        await userEvent.click(dialog.getByRole("button", { name: "Registrar servicio" }));
        expect(attempts).toBe(1);
        const beforeInspection = reads.length;
        await userEvent.click(
          dialog.getByRole("button", { name: "Actualizar ficha sin repetir el comando" }),
        );
        await settleFleet({ api, app, reads }, { since: beforeInspection });
        await dialog.findByText(/Última lectura explícita de esta ficha/);
        expect(attempts).toBe(1);
        expect(
          dialog.getByRole("button", { name: "Registrar servicio" }).getAttribute("aria-disabled"),
        ).toBe("true");
        expect(
          dialog.getByRole<HTMLTextAreaElement>("textbox", { name: "Observaciones" }).value,
        ).toBe("Private retained service attempt");
        await userEvent.click(dialog.getByRole("button", { name: "Descartar este intento" }));
      } else {
        await waitFor(() => {
          expect(
            dialog
              .getByRole("button", { name: "Registrar servicio" })
              .getAttribute("aria-disabled"),
          ).toBe("false");
        });
        await userEvent.click(dialog.getByRole("button", { name: "Registrar servicio" }));
        await waitFor(() => {
          expect(screen.queryByRole("dialog")).toBeNull();
        });
        expect(
          api.requests
            .filter((request) => request.method === "POST" && request.path === path)
            .map((request) => request.body),
        ).toEqual(
          Array.from({ length: 2 }, () => ({
            kind: "inspection",
            performed_at: "2026-11-01",
            odometer_km: 12600,
            notes: "Private retained service attempt",
            service_interval_km: null,
            service_interval_days: null,
          })),
        );
      }
    },
  );
  test("revocation retires pending private evidence and its late verification cannot revive it after regrant", async () => {
    const fault = fleetFault();
    const upload = "00000000-0000-4000-8000-000000000023";
    const late = deferred();
    const me = makeMe({
      ...ALLOWED,
      permissions: ["motorcycle.read", "motorcycle.service_clear", "field.upload"],
    });
    const { api, app, reads } = await openFleet({
      path: `${LIST}/M-03?tab=incidents`,
      me,
      routes: {
        "GET /api/v1/incidents/": () => historyPage([fault]),
        "POST /api/v1/field/uploads/": () =>
          Response.json({
            upload_id: upload,
            url: `/api/v1/field/uploads/${upload}/content/`,
            method: "PUT",
            headers: { "Upload-Lease": "synthetic-lease", "Content-Type": "image/png" },
            expires_at: "2026-11-07T12:00:00Z",
          }),
        [`PUT /api/v1/field/uploads/${upload}/content/`]: () => new Response(null, { status: 204 }),
        [`POST /api/v1/field/uploads/${upload}/finalize/`]: () => late.promise,
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Liberar esta falla grave" }));
    let dialog = within(screen.getByRole("dialog"));
    await userEvent.click(dialog.getByRole("textbox"));
    await userEvent.paste("Private proof before real revocation");
    await userEvent.upload(dialog.getByLabelText("Evidencia JPEG/PNG"), evidenceFile().file);
    await userEvent.click(dialog.getByRole("button", { name: "Cargar y verificar evidencia" }));
    await waitFor(() => {
      expect(api.requests.some((request) => request.path.endsWith("/finalize/"))).toBe(true);
    });
    const denialBoundary = reads.length;
    const readonly = makeMe({ ...me, permissions: ["motorcycle.read"] });
    api.setRoute("GET /api/v1/me/", Response.json(readonly));
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await settleFleet({ api, app, reads }, { since: denialBoundary, me: readonly });
    await settleFleet(
      { api, app, reads },
      { since: denialBoundary, me: readonly, kind: "incidents" },
    );
    await within(screen.getByRole("main")).findByRole("table", { name: "Incidentes" });
    expect(screen.queryByRole("dialog")).toBeNull();
    const regrantBoundary = reads.length;
    api.setRoute("GET /api/v1/me/", Response.json(me));
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await settleFleet({ api, app, reads }, { since: regrantBoundary, me });
    await settleFleet({ api, app, reads }, { since: regrantBoundary, me, kind: "incidents" });
    await userEvent.click(await screen.findByRole("button", { name: "Liberar esta falla grave" }));
    dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole<HTMLTextAreaElement>("textbox").value).toBe("");
    const obsolete = observeFleetBody(
      Response.json({
        id: upload,
        state: "verified",
        verified_at: "2026-11-07T11:55:00Z",
      }),
    );
    await act(async () => {
      late.release(obsolete.response);
      await obsolete.parsed;
    });
    await waitFor(() => {
      expect(obsolete.response.bodyUsed).toBe(true);
    });
    expect(dialog.queryByText(/Evidencia verificada/)).toBeNull();
    expect(dialog.queryByText(upload)).toBeNull();
    expect(api.requests.some((request) => request.path.endsWith("/clear-fault/"))).toBe(false);
    expect(api.requests.filter((request) => request.method === "PUT")).toHaveLength(1);
  });
  test("a permitted service draft waits for the actual current read through center ABA, while real scope denial retires it", async () => {
    const center = "00000000-0000-4000-8000-000000000030";
    const item = motorcycle({ center });
    const oldDetail = deferred();
    const newDetail = deferred();
    let details = 0;
    const { api, app, reads } = await openFleet({
      path: `${LIST}/M-03?center=${center}`,
      routes: {
        [GET]: () => pageOf([item]),
        [`GET /api/v1/motorcycles/${item.id}/`]: () => {
          details += 1;
          if (details === 2) return oldDetail.promise;
          if (details === 3) return newDetail.promise;
          return Response.json(motorcycleDetail(item));
        },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Registrar servicio" }));
    await userEvent.type(
      within(screen.getByRole("dialog")).getByRole("textbox", { name: "Observaciones" }),
      "Retained authorized inspection draft",
    );
    const scopeBoundary = reads.length;
    await act(async () => {
      await app.router.navigate({
        to: "/fleet/motorcycles/$code",
        params: { code: "M-03" },
        search: {},
      });
    });
    await waitFor(() => {
      expect(details).toBe(2);
    });
    expect(screen.queryByRole("textbox", { name: "Observaciones" })).toBeNull();
    await act(async () => {
      await app.router.navigate({
        to: "/fleet/motorcycles/$code",
        params: { code: "M-03" },
        search: { center },
      });
    });
    await waitFor(() => {
      expect(details).toBe(3);
    });
    const obsolete = observeFleetBody(
      Response.json(
        motorcycleDetail({
          ...item,
          metrics: { ...motorcycleDetail().metrics, latest_odometer: 999999 },
        }),
      ),
    );
    await act(async () => {
      oldDetail.release(obsolete.response);
      await obsolete.parsed;
    });
    await waitFor(() => {
      expect(obsolete.response.bodyUsed).toBe(true);
    });
    expect(screen.queryByText("999,999")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Observaciones" })).toBeNull();
    await act(async () => {
      newDetail.release(Response.json(motorcycleDetail(item)));
      await newDetail.promise;
    });
    await settleFleet({ api, app, reads }, { since: scopeBoundary, center });
    expect(
      (await screen.findByRole<HTMLTextAreaElement>("textbox", { name: "Observaciones" })).value,
    ).toBe("Retained authorized inspection draft");
    api.setRoute(
      "GET /api/v1/me/",
      Response.json({
        ...ALLOWED,
        scope: { centers: { mode: "none", ids: [] }, quadrants: { mode: "all", ids: [] } },
      }),
    );
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await screen.findByRole("heading", { name: "No encontramos esta página" });
    expect(screen.queryByRole("textbox", { name: "Observaciones" })).toBeNull();
    const restoreBoundary = reads.length;
    api.setRoute("GET /api/v1/me/", Response.json(ALLOWED));
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await settleFleet({ api, app, reads }, { since: restoreBoundary, center });
    await userEvent.click(await screen.findByRole("button", { name: "Registrar servicio" }));
    expect(
      within(screen.getByRole("dialog")).getByRole<HTMLTextAreaElement>("textbox", {
        name: "Observaciones",
      }).value,
    ).toBe("");
    expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(0);
  });
  test.each(["user", "organization"])(
    "a changed %s clears rows and ignores the previous pending read",
    async (context) => {
      const late = deferred();
      let reads = 0;
      const {
        api,
        app,
        reads: tracedReads,
      } = await openFleet({
        routes: {
          [GET]: () =>
            ++reads === 2
              ? late.promise
              : pageOf([motorcycle({ code: reads === 1 ? "OLD-PRIVATE" : "NEW-SCOPED" })]),
        },
      });
      await screen.findByRole("link", { name: "OLD-PRIVATE" });
      let refresh: Promise<void> = Promise.resolve();
      act(() => {
        refresh = app.queryClient.refetchQueries({
          predicate: (query) => query.queryKey[3] === "fleet",
        });
      });
      await waitFor(() => {
        expect(reads).toBe(2);
      });
      const next =
        context === "user"
          ? { ...ALLOWED, user: { ...ALLOWED.user, id: "another-user" } }
          : {
              ...ALLOWED,
              organization: makeOrganization("sur", "South"),
              organizations: [{ slug: "sur", name: "South" }],
            };
      const identityBoundary = tracedReads.length;
      api.setRoute("GET /api/v1/me/", (request) =>
        context === "organization" && request.headers.has("X-Organization")
          ? apiError(403, "no_active_membership")
          : Response.json(next),
      );
      await act(async () => {
        await app.queryClient.refetchQueries({ queryKey: ["me"] });
      });
      await settleFleet(
        { api, app, reads: tracedReads },
        { since: identityBoundary, kind: "list", me: next },
      );
      await screen.findByRole("link", { name: "NEW-SCOPED" });
      expect(screen.queryByText("OLD-PRIVATE")).toBeNull();
      const obsolete = observeFleetBody(pageOf([motorcycle({ code: "LATE-PRIVATE" })]));
      await act(async () => {
        late.release(obsolete.response);
        await obsolete.parsed;
        await refresh;
      });
      expect(screen.queryByText("LATE-PRIVATE")).toBeNull();
      expect(screen.getByRole("link", { name: "NEW-SCOPED" })).toBeDefined();
    },
  );

  test("an identity change dismisses a draft and ignores a pending write", async () => {
    const late = deferred();
    const { api, app } = await openFleet({
      path: `${LIST}/M-03`,
      routes: { [`POST /api/v1/motorcycles/${motorcycle().id}/unblock/`]: () => late.promise },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Desbloquear" }));
    await userEvent.type(
      within(screen.getByRole("dialog")).getByRole("textbox"),
      "Private inspection evidence",
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Desbloquear" }),
    );
    const busyDialog = within(screen.getByRole("dialog"));
    await userEvent.click(busyDialog.getByRole("button", { name: "Desbloqueando…" }));
    await userEvent.click(busyDialog.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(
      api.requests.filter(({ method, path }) => method === "POST" && path.endsWith("/unblock/")),
    ).toHaveLength(1);
    const next = makeMe({
      permissions: ["motorcycle.read"],
      user: { ...ALLOWED.user, id: "another-user" },
    });
    api.setRoute("GET /api/v1/me/", Response.json(next));
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await screen.findByRole("heading", { name: "No encontramos esta página" });
    const readsBeforeLateWrite = api.requests.filter(
      ({ method, path }) => method === "GET" && path.startsWith("/api/v1/motorcycles/"),
    ).length;
    const obsolete = observeFleetBody(apiError(401, "not_authenticated"));
    await act(async () => {
      late.release(obsolete.response);
      await obsolete.parsed;
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      api.requests.filter(
        ({ method, path }) => method === "GET" && path.startsWith("/api/v1/motorcycles/"),
      ),
    ).toHaveLength(readsBeforeLateWrite);
    expect(screen.queryByText("Private inspection evidence")).toBeNull();
  });

  test("an expired write is never replayed after successful reauthentication", async () => {
    const { api, app, reads } = await openFleet({
      path: `${LIST}/M-03`,
      routes: {
        [`POST /api/v1/motorcycles/${motorcycle().id}/unblock/`]: apiError(
          401,
          "not_authenticated",
        ),
        "POST /api/v1/auth/login/": Response.json({
          me: ALLOWED,
          server_time: "2026-11-04T12:00:00Z",
        }),
      },
    });
    document.cookie = "csrftoken=test-csrf; path=/";
    await userEvent.click(await screen.findByRole("button", { name: "Desbloquear" }));
    await userEvent.type(
      within(screen.getByRole("dialog")).getByRole("textbox"),
      "Repair checked and recorded",
    );
    const reauthBoundary = reads.length;
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Desbloquear" }),
    );
    const password = await screen.findByLabelText("Contraseña");
    expect(screen.queryByRole("dialog", { name: "Desbloquear M-03" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: /Motivo y evidencia/ })).toBeNull();
    await userEvent.type(password, fakePassword());
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => {
      expect(screen.queryByLabelText("Contraseña")).toBeNull();
    });
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await settleFleet({ api, app, reads }, { since: reauthBoundary });
    expect(
      api.requests.filter(({ method, path }) => method === "POST" && path.endsWith("/unblock/")),
    ).toHaveLength(1);
  });
});
