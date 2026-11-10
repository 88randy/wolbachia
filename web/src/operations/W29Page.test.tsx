import { axe } from "jest-axe";
import { bumpEpoch, currentRevision } from "../session/session-revision";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { apiError, makeOrganization } from "../test/fake-api";
import {
  openShift,
  shiftDetail,
  decision,
  DETAIL,
  SHIFT_PATH,
  ALLOWED,
} from "./shift-test-helpers";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((release) => {
    resolve = release;
  });
  return { promise, resolve };
}
async function openObservation() {
  const user = userEvent.setup();
  const trigger = await screen.findByRole("button", { name: "Enviar observación" });
  trigger.focus();
  await user.keyboard("{Enter}");
  return { user, trigger, dialog: within(screen.getByRole("dialog")) };
}

test("the keyboard timeline exposes real lifecycle events and an explicit GPS gap", async () => {
  await openShift();
  const timeline = await screen.findByRole("list", { name: "Línea de tiempo disponible" });
  expect(within(timeline).getAllByRole("listitem")).toHaveLength(2);
  expect(within(timeline).getByText("Synthetic closing")).toBeDefined();
  expect(screen.getByText(/Recorrido GPS no disponible/)).toBeDefined();
  expect(screen.getByText(/umbral y versión todavía no está disponible/)).toBeDefined();
  const { user, trigger, dialog } = await openObservation();
  expect(dialog.getByRole("textbox", { name: "Motivo (obligatorio)" })).toBeDefined();
  expect(document.activeElement).toBe(dialog.getByRole("button", { name: "Cancelar" }));
  await user.keyboard("{Escape}");
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  expect(document.activeElement).toBe(trigger);
});

test.each(["approve", "observe"] as const)(
  "a %s decision requires a reason and appears only in returned shift history",
  async (kind) => {
    const saved = decision(kind);
    const label = kind === "approve" ? "Aprobar jornada" : "Enviar observación";
    const { api } = await openShift({
      routes: {
        ["POST " + DETAIL + kind + "/"]: () => {
          api.setRoute(
            "GET " + DETAIL,
            Response.json(
              shiftDetail({
                validation: {
                  revision: 1,
                  kind,
                  latest_decision: saved.id,
                  approval_current: kind === "approve",
                  blockers: [],
                },
                validation_timeline: [saved],
              }),
            ),
          );
          return Response.json(saved, { status: 201 });
        },
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: label }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: label }));
    expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(0);
    expect(dialog.getByText("Escribe un motivo con la longitud mínima indicada.")).toBeDefined();
    await user.type(dialog.getByRole("textbox"), saved.reason);
    await user.click(dialog.getByRole("button", { name: label }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    const history = screen.getByRole("region", { name: "Historial de validación" });
    expect(await within(history).findByText(saved.reason)).toBeDefined();
    expect(within(history).getByText(ALLOWED.user.id)).toBeDefined();
    expect(api.requests.find((request) => request.method === "POST")?.body).toEqual({
      reason: saved.reason,
      expected_revision: 0,
    });
    expect(
      screen.getByText(/historial de los puntos \(W4\) todavía no está disponible/),
    ).toBeDefined();
  },
);

test("a 409 keeps the draft and freezes resubmission until explicit review", async () => {
  const { api } = await openShift({
    routes: { ["POST " + DETAIL + "observe/"]: apiError(409, "review_conflict") },
  });
  const { user, dialog } = await openObservation();
  await user.type(dialog.getByRole("textbox"), "Synthetic review reason");
  await user.click(dialog.getByRole("button", { name: "Enviar observación" }));
  await dialog.findByText(/La jornada cambió/);
  expect(dialog.getByRole<HTMLTextAreaElement>("textbox").value).toBe("Synthetic review reason");
  await user.click(dialog.getByRole("button", { name: "Enviar observación" }));
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  await user.click(dialog.getByRole("button", { name: "Cancelar" }));
  await user.click(screen.getByRole("button", { name: "Enviar observación" }));
  const unreviewed = within(screen.getByRole("dialog"));
  expect(
    unreviewed.getByRole("button", { name: "Enviar observación" }).getAttribute("aria-disabled"),
  ).toBe("true");
  await user.click(unreviewed.getByRole("button", { name: "Cancelar" }));
  const saved = decision("approve");
  api.setRoute(
    "GET " + DETAIL,
    Response.json(
      shiftDetail({
        validation: {
          revision: 1,
          kind: "approve",
          latest_decision: saved.id,
          approval_current: true,
          blockers: [],
        },
        validation_timeline: [saved],
      }),
    ),
  );
  await user.click(screen.getByRole("button", { name: "Actualizar jornada" }));
  await screen.findByText(saved.reason);
  api.setRoute("POST " + DETAIL + "observe/", Response.json(decision("observe"), { status: 201 }));
  await user.click(screen.getByRole("button", { name: "Enviar observación" }));
  const reopened = within(screen.getByRole("dialog"));
  expect(reopened.getByRole<HTMLTextAreaElement>("textbox").value).toBe("Synthetic review reason");
  await user.click(reopened.getByRole("button", { name: "Enviar observación" }));
  await waitFor(() => {
    expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(2);
  });
  expect(api.requests.filter((request) => request.method === "POST")[1]?.body).toEqual({
    reason: "Synthetic review reason",
    expected_revision: 1,
  });
});

test("an open shift explains why both actions are unavailable and sends no decision", async () => {
  const { api } = await openShift({
    shift: shiftDetail({ status: "open", closed_at_device: null, closed_event: null }),
  });
  const approve = await screen.findByRole("button", { name: "Aprobar jornada" });
  expect(approve.getAttribute("aria-disabled")).toBe("true");
  expect(
    screen.getByRole("button", { name: "Enviar observación" }).getAttribute("aria-disabled"),
  ).toBe("true");
  expect(screen.getByText(/El repartidor debe cerrarla/)).toBeDefined();
  await userEvent.click(approve);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(0);
});

test("read-only permission hides decision controls and missing read permission denies the route", async () => {
  const app = await openShift({ permissions: ["shift.read"] });
  await screen.findByRole("heading", { name: "Resumen de la jornada" });
  expect(screen.queryByRole("button", { name: "Aprobar jornada" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Enviar observación" })).toBeNull();
  app.api.setRoute("GET /api/v1/me/", Response.json({ ...ALLOWED, permissions: [] }));
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  await waitFor(() => {
    expect(screen.queryByRole("heading", { name: "Resumen de la jornada" })).toBeNull();
  });
});

test("pending and uncertain requests never duplicate or report a saved decision", async () => {
  const reply = deferred<Response>();
  const { api } = await openShift({
    routes: { ["POST " + DETAIL + "observe/"]: () => reply.promise },
  });
  const { user, dialog } = await openObservation();
  await user.type(dialog.getByRole("textbox"), "Synthetic review reason");
  const submit = dialog.getByRole("button", { name: "Enviar observación" });
  await user.dblClick(submit);
  await waitFor(() => {
    expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  });
  await act(async () => {
    reply.resolve(apiError(503, "service_unavailable"));
    await reply.promise;
  });
  await dialog.findByText(/No pudimos confirmar la decisión/);
  await user.click(submit);
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  expect(dialog.getByRole<HTMLTextAreaElement>("textbox").value).toBe("Synthetic review reason");
  expect(screen.queryByText(/Decisión guardada/)).toBeNull();
});

test("an identity switch retires drafts and late responses without exposing the old shift", async () => {
  const pending = deferred<Response>();
  const nextRead = deferred<Response>();
  const app = await openShift({
    routes: { ["POST " + DETAIL + "observe/"]: () => pending.promise },
  });
  const { user, dialog } = await openObservation();
  await user.type(dialog.getByRole("textbox"), "Private old organization reason");
  await user.click(dialog.getByRole("button", { name: "Enviar observación" }));
  await waitFor(() => {
    expect(app.api.requests.some((request) => request.method === "POST")).toBe(true);
  });
  app.api.setRoute(
    "GET /api/v1/me/",
    Response.json({ ...ALLOWED, organization: makeOrganization("south", "South") }),
  );
  app.api.setRoute("GET " + DETAIL, () => nextRead.promise);
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  expect(screen.queryByText("Synthetic closing")).toBeNull();
  await act(async () => {
    pending.resolve(Response.json(decision("observe"), { status: 201 }));
    await pending.promise;
  });
  expect(screen.queryByText(/Decisión guardada/)).toBeNull();
  await act(async () => {
    nextRead.resolve(Response.json(shiftDetail({ close_note: "Current organization closing" })));
    await nextRead.promise;
  });
  await screen.findByText("Current organization closing");
  await user.click(screen.getByRole("button", { name: "Enviar observación" }));
  expect(within(screen.getByRole("dialog")).getByRole<HTMLTextAreaElement>("textbox").value).toBe(
    "",
  );
  expect(app.router.state.location.pathname).toBe(SHIFT_PATH);
});

test("a failed refresh keeps readable facts but disables decisions until a successful read", async () => {
  const { api } = await openShift();
  await screen.findByText("Synthetic closing");
  api.setRoute("GET " + DETAIL, apiError(503, "service_unavailable"));
  await userEvent.click(screen.getByRole("button", { name: "Actualizar jornada" }));
  await screen.findByRole("alert");
  expect(screen.getByText("Synthetic closing")).toBeDefined();
  expect(
    screen.getByRole("button", { name: "Aprobar jornada" }).getAttribute("aria-disabled"),
  ).toBe("true");
});

test("the W29 entry list sends URL status and page to the server", async () => {
  const { api } = await openShift({
    path: "/operations/shifts?status=closed&page=2",
    routes: {
      "GET /api/v1/shifts/": Response.json({
        count: 26,
        next: null,
        previous: null,
        results: [shiftDetail()],
      }),
    },
  });
  await screen.findByRole("cell", { name: "M-03" });
  const rowLink = screen
    .getAllByRole("link")
    .find((link) => link.getAttribute("href") === SHIFT_PATH);
  expect(rowLink?.getAttribute("href")).toBe(SHIFT_PATH);
  const request = api.requests.find((entry) => entry.path.startsWith("/api/v1/shifts/?"));
  const params = new URLSearchParams(request?.path.split("?")[1]);
  expect(params.get("status")).toBe("closed");
  expect(params.get("page")).toBe("2");
});

test.each([403, 404])("a denied refresh (%s) removes private facts and drafts", async (status) => {
  const { api } = await openShift();
  await screen.findByText("Synthetic closing");
  api.setRoute("GET " + DETAIL, apiError(status, "not_found"));
  await userEvent.click(screen.getByRole("button", { name: "Actualizar jornada" }));
  await waitFor(() => {
    expect(screen.queryByText("Synthetic closing")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar observación" })).toBeNull();
  });
  api.setRoute("GET " + DETAIL, apiError(503, "service_unavailable"));
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByRole("alert");
  expect(screen.queryByText("Synthetic closing")).toBeNull();
  expect(screen.queryByRole("button", { name: "Enviar observación" })).toBeNull();
  api.setRoute(
    "GET " + DETAIL,
    Response.json(shiftDetail({ close_note: "Fresh authorized closing" })),
  );
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  await screen.findByText("Fresh authorized closing");
});

test("a read issued before an uncertain decision cannot unlock resubmission", async () => {
  const reply = deferred<Response>();
  const pendingRead = deferred<Response>();
  const app = await openShift({ routes: { ["POST " + DETAIL + "observe/"]: () => reply.promise } });
  const { user, dialog } = await openObservation();
  await user.type(dialog.getByRole("textbox"), "Synthetic review reason");
  await user.click(dialog.getByRole("button", { name: "Enviar observación" }));
  await waitFor(() => {
    expect(app.api.requests.some((request) => request.method === "POST")).toBe(true);
  });
  const initialReads = app.api.requests.filter(
    (request) => request.method === "GET" && request.path === DETAIL,
  ).length;
  app.api.setRoute("GET " + DETAIL, () => pendingRead.promise);
  act(() => {
    void app.queryClient.refetchQueries({
      predicate: (query) => query.queryKey.includes("shifts"),
    });
  });
  await waitFor(() => {
    expect(
      app.api.requests.filter((request) => request.method === "GET" && request.path === DETAIL),
    ).toHaveLength(initialReads + 1);
  });
  await act(async () => {
    reply.resolve(apiError(503, "service_unavailable"));
    await reply.promise;
  });
  await dialog.findByText(/No pudimos confirmar la decisión/);
  await user.click(dialog.getByRole("button", { name: "Cancelar" }));
  await act(async () => {
    pendingRead.resolve(Response.json(shiftDetail()));
    await pendingRead.promise;
  });
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Enviar observación" }).getAttribute("aria-disabled"),
    ).toBe("false");
  });
  await user.click(screen.getByRole("button", { name: "Enviar observación" }));
  expect(
    within(screen.getByRole("dialog"))
      .getByRole("button", { name: "Enviar observación" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
  expect(app.api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
});

test("same-identity reauthentication retires a hung attempt without losing its draft or unlocking a new attempt", async () => {
  const oldReply = deferred<Response>();
  const newReply = deferred<Response>();
  const app = await openShift({
    routes: {
      ["GET " + DETAIL]: () => Response.json(shiftDetail()),
      ["POST " + DETAIL + "observe/"]: () => oldReply.promise,
    },
  });
  const { user, dialog } = await openObservation();
  await user.type(dialog.getByRole("textbox"), "Reason retained through reauthentication");
  await user.click(dialog.getByRole("button", { name: "Enviar observación" }));
  await waitFor(() => {
    expect(app.api.requests.some((request) => request.method === "POST")).toBe(true);
  });
  const readsBeforeReauthentication = app.api.requests.filter(
    (request) => request.method === "GET" && request.path === DETAIL,
  ).length;
  act(() => {
    bumpEpoch();
  });
  await user.click(dialog.getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() => {
    expect(
      app.api.requests.filter((request) => request.method === "GET" && request.path === DETAIL)
        .length,
    ).toBeGreaterThan(readsBeforeReauthentication);
    const currentQuery = app.queryClient.getQueryCache().findAll({
      predicate: (query) =>
        query.isActive() && query.queryKey.includes("shifts") && query.queryKey.includes("detail"),
    })[0];
    expect(currentQuery?.meta?.["revision"]).toBe(currentRevision());
    expect(currentQuery?.state.status).toBe("success");
    expect(currentQuery?.state.fetchStatus).toBe("idle");
    expect(
      screen.getByRole("button", { name: "Enviar observación" }).getAttribute("aria-disabled"),
    ).toBe("false");
  });
  app.api.setRoute("POST " + DETAIL + "observe/", () => newReply.promise);
  await user.click(screen.getByRole("button", { name: "Enviar observación" }));
  const reopened = within(screen.getByRole("dialog"));
  expect(reopened.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
    "Reason retained through reauthentication",
  );
  await user.click(reopened.getByRole("button", { name: "Enviar observación" }));
  await waitFor(() => {
    expect(app.api.requests.filter((request) => request.method === "POST")).toHaveLength(2);
  });
  await act(async () => {
    oldReply.resolve(Response.json(decision("observe"), { status: 201 }));
    await oldReply.promise;
  });
  expect(screen.queryByText(/Decisión guardada/)).toBeNull();
  expect(
    reopened.getByRole("button", { name: "Enviar observación" }).getAttribute("aria-busy"),
  ).toBe("true");
  await act(async () => {
    newReply.resolve(apiError(503, "service_unavailable"));
    await newReply.promise;
  });
  await reopened.findByText(/No pudimos confirmar la decisión/);
});

test("W29 has accessible labels and regions", async () => {
  await openShift();
  await screen.findByText("Synthetic closing");
  expect(await axe(screen.getByRole("main"))).toHaveNoViolations();
});
