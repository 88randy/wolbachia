import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { bumpEpoch } from "../../session/session-revision";
import { apiError } from "../../test/fake-api";
import {
  openTrainings,
  eligibility,
  SUBJECT,
  CENTER,
  VERSION,
  TRAINING_ME,
} from "./training-test-helpers";
beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-09T12:00:00Z"));
});
afterEach(() => {
  vi.restoreAllMocks();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((release) => {
    resolve = release;
  });
  return { promise, resolve };
}
async function fillCertificate() {
  const user = userEvent.setup({ delay: null });
  await user.click(await screen.findByRole("button", { name: "Registrar certificación" }));
  const dialog = within(screen.getByRole("dialog"));
  const fields = {
    "Versión del curso (UUID)": VERSION,
    "Inicio incluido": "2026-11-09T12:00:00Z",
    "Fin excluido": "2026-11-10T12:00:00Z",
    "UUID de evidencias verificadas": "00000000-0000-4000-8000-000000000040",
    "Referencia de quien expide": "Synthetic issuer",
    "Constancia de certificación": "Synthetic verified attendance",
  };
  for (const [label, value] of Object.entries(fields)) {
    await user.click(dialog.getByRole("textbox", { name: label }));
    await user.paste(value);
  }
  return { user, dialog };
}
function savedReceipt() {
  return {
    command_id: "00000000-0000-4000-8000-000000000050",
    id: "00000000-0000-4000-8000-000000000051",
    revision: 1,
    recorded_at: "2026-11-09T12:01:00Z",
    evaluation: null,
  };
}

test("a confirmed certificate is terminal and sequential Enter cannot create a second record", async () => {
  const { api } = await openTrainings({
    path: `/people/trainings?subject=${SUBJECT}&center=${CENTER}`,
    routes: {
      [`POST /api/v1/users/${SUBJECT}/trainings/`]: Response.json(savedReceipt(), { status: 201 }),
    },
  });
  const { user, dialog } = await fillCertificate();
  const submit = dialog.getByRole("button", { name: "Registrar certificación" });
  await user.click(submit);
  await dialog.findByText("Registro confirmado por el servidor.");
  submit.focus();
  await user.keyboard("{Enter}{Enter}");
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
});

test("a certificate response from an earlier session revision keeps the draft and requires deliberate review", async () => {
  const reply = deferred<Response>();
  const { api } = await openTrainings({
    path: `/people/trainings?subject=${SUBJECT}&center=${CENTER}`,
    routes: { [`POST /api/v1/users/${SUBJECT}/trainings/`]: () => reply.promise },
  });
  const { user, dialog } = await fillCertificate();
  const submit = dialog.getByRole("button", { name: "Registrar certificación" });
  await user.click(submit);
  await waitFor(() => {
    expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  });
  act(() => {
    bumpEpoch();
  });
  act(() => {
    reply.resolve(Response.json(savedReceipt(), { status: 201 }));
  });
  await dialog.findByRole("button", { name: "Revisé el historial; permitir otro intento" });
  expect(dialog.queryByText("Registro confirmado por el servidor.")).toBeNull();
  expect(
    dialog.getByRole<HTMLInputElement>("textbox", { name: "Referencia de quien expide" }).value,
  ).toBe("Synthetic issuer");
  submit.focus();
  await user.keyboard("{Enter}");
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
});

test("server eligibility remains faithful on both sides of the exclusive expiry boundary", async () => {
  const at = "2026-11-10T12:00:00Z";
  const app = await openTrainings({
    path: `/people/trainings?subject=${SUBJECT}&center=${CENTER}&action=release.record&at=${encodeURIComponent(at)}`,
    routes: {
      [`GET /api/v1/users/${SUBJECT}/eligibility/`]: Response.json(
        eligibility({
          training_eligible: false,
          blockers: ["certification_missing_or_expired"],
          certification_ids: [],
        }),
      ),
    },
  });
  expect(await screen.findByText("Acción bloqueada por capacitación")).toBeDefined();
  expect(screen.getByText(/Administración debe revisar los requisitos/)).toBeDefined();
  expect(screen.getByText(/La certificación requerida falta, está vencida/)).toBeDefined();
  const request = app.api.requests.find((row) => row.path.includes("/eligibility/"));
  expect(new URL(`https://example.test${request?.path ?? ""}`).searchParams.get("at")).toBe(at);
  app.api.setRoute(`GET /api/v1/users/${SUBJECT}/eligibility/`, Response.json(eligibility()));
  await act(async () => {
    await app.router.navigate({
      to: "/people/trainings",
      search: {
        subject: SUBJECT,
        center: CENTER,
        action: "release.record",
        at: "2026-11-10T11:59:59Z",
      },
    });
  });
  expect(await screen.findByText("Capacitación vigente")).toBeDefined();
  expect(screen.queryByText("Acción bloqueada por capacitación")).toBeNull();
});

test("a certificate's keyboard validation and server failure retain all entered fields", async () => {
  const app = await openTrainings({
    path: `/people/trainings?subject=${SUBJECT}&center=${CENTER}`,
    routes: { [`POST /api/v1/users/${SUBJECT}/trainings/`]: apiError(400, "validation_error") },
  });
  const user = userEvent.setup({ delay: null });
  await user.click(await screen.findByRole("button", { name: "Registrar certificación" }));
  const dialog = within(screen.getByRole("dialog"));
  await user.click(dialog.getByRole("button", { name: "Registrar certificación" }));
  expect(dialog.getByText("Revisa los campos indicados.")).toBeDefined();
  expect(app.api.requests.filter((request) => request.method === "POST")).toHaveLength(0);
  const fields = {
    "Versión del curso (UUID)": VERSION,
    "Inicio incluido": "2026-11-09T12:00:00Z",
    "Fin excluido": "2026-11-10T12:00:00Z",
    "UUID de evidencias verificadas": "00000000-0000-4000-8000-000000000040",
    "Referencia de quien expide": "Synthetic issuer",
    "Constancia de certificación": "Synthetic verified attendance",
  };
  for (const [label, value] of Object.entries(fields)) {
    await user.click(dialog.getByRole("textbox", { name: label }));
    await user.paste(value);
  }
  await user.click(dialog.getByRole("button", { name: "Registrar certificación" }));
  expect(await dialog.findByText(/No pudimos confirmar el registro/)).toBeDefined();
  for (const [label, value] of Object.entries(fields))
    expect(dialog.getByRole<HTMLInputElement>("textbox", { name: label }).value).toBe(value);
  expect(app.api.requests.filter((request) => request.method === "POST")[0]?.body).toMatchObject({
    center: CENTER,
    quadrant: null,
    training_version: VERSION,
    valid_from: fields["Inicio incluido"],
    valid_to: fields["Fin excluido"],
  });
});

test("an out-of-scope personal deep link never starts a private read or certification write", async () => {
  const { api } = await openTrainings({
    path: `/people/trainings?subject=${SUBJECT}&center=${CENTER}`,
    me: {
      ...TRAINING_ME,
      scope: {
        ...TRAINING_ME.scope,
        centers: { mode: "selected", ids: ["00000000-0000-4000-8000-000000000099"] },
      },
    },
  });
  expect(await screen.findByText(/El registro no está disponible en tu alcance/)).toBeDefined();
  expect(screen.queryByRole("button", { name: "Registrar certificación" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Nuevo curso" })).toBeNull();
  expect(api.requests.some((request) => request.path.includes("/users/"))).toBe(false);
});

test.each(["UNKNOWN-COURSE", "FOREIGN-COURSE"])(
  "an unavailable scoped course code %s exposes the same empty state and no version read",
  async (course) => {
    const { api } = await openTrainings({ path: `/people/trainings?course=${course}` });
    expect(await screen.findByText(/El registro no está disponible en tu alcance/)).toBeDefined();
    expect(api.requests.some((request) => request.path.includes("/versions/"))).toBe(false);
  },
);

test("scope loss clears displayed eligibility and its cached personal projection", async () => {
  const app = await openTrainings({
    path: `/people/trainings?subject=${SUBJECT}&center=${CENTER}&action=release.record`,
    routes: { [`GET /api/v1/users/${SUBJECT}/eligibility/`]: Response.json(eligibility()) },
  });
  await screen.findByText("Capacitación vigente");
  app.api.setRoute(
    "GET /api/v1/me/",
    Response.json({
      ...TRAINING_ME,
      scope: { centers: { mode: "selected", ids: [] }, quadrants: { mode: "all", ids: [] } },
    }),
  );
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  await waitFor(() => {
    expect(screen.queryByText("Capacitación vigente")).toBeNull();
  });
  expect(
    app.queryClient
      .getQueriesData({ predicate: (query) => query.queryKey[3] === "peopleTrainings" })
      .every(([, value]) => value === undefined),
  ).toBe(true);
});

test("a permitted context keeps its private draft across scope changes while late commands require review", async () => {
  const reply = deferred<Response>();
  const { api, queryClient } = await openTrainings({
    path: `/people/trainings?subject=${SUBJECT}&center=${CENTER}`,
    routes: { [`POST /api/v1/users/${SUBJECT}/trainings/`]: () => reply.promise },
  });
  const { user, dialog } = await fillCertificate();
  await user.click(dialog.getByRole("button", { name: "Registrar certificación" }));
  await waitFor(() => {
    expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  });
  api.setRoute(
    "GET /api/v1/me/",
    Response.json({
      ...TRAINING_ME,
      scope: { centers: { mode: "selected", ids: [CENTER] }, quadrants: { mode: "none", ids: [] } },
    }),
  );
  await act(async () => {
    await queryClient.refetchQueries({ queryKey: ["me"] });
  });
  act(() => {
    reply.resolve(Response.json(savedReceipt(), { status: 201 }));
  });
  await dialog.findByRole("button", { name: "Revisé el historial; permitir otro intento" });
  expect(
    dialog.getByRole<HTMLInputElement>("textbox", { name: "Referencia de quien expide" }).value,
  ).toBe("Synthetic issuer");
  expect(dialog.queryByText("Registro confirmado por el servidor.")).toBeNull();
  await user.click(dialog.getByRole("button", { name: "Registrar certificación" }));
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
});
