import { act, screen, waitFor, within } from "@testing-library/react";
import type { BoundFunctions, queries } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { bumpEpoch } from "../../session/session-revision";
import { apiError } from "../../test/fake-api";
import type { FakeApiRoutes } from "../../test/fake-api";
import {
  openTrainings,
  page,
  eligibility,
  SUBJECT,
  CENTER,
  VERSION,
  TRAINING_ME,
} from "./training-test-helpers";
vi.mock("./certificate-evidence", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./certificate-evidence")>()),
  uploadCertificateEvidence: (call: { onAuthorized: (id: string) => void }) => {
    call.onAuthorized(UPLOAD);
    return Promise.resolve({ uploadId: UPLOAD, verifiedAt: "2026-11-09T12:01:00Z" });
  },
}));
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
type Dialog = BoundFunctions<typeof queries>;
const COURSE = "00000000-0000-4000-8000-000000000060";
const UPLOAD = "00000000-0000-4000-8000-000000000061";
const TEXT_FIELDS = {
  "Referencia de quien expide": "Synthetic issuer",
  "Constancia de certificación": "Synthetic verified attendance",
};
/** Courses for the version picker. The image upload itself is covered by certificate-evidence.test.ts. */
function certificateRoutes(extra: FakeApiRoutes = {}): FakeApiRoutes {
  return {
    "GET /api/v1/trainings/": Response.json(
      page([{ id: COURSE, code: "C-60", name: "Synthetic course", current_version_id: VERSION }]),
    ),
    [`GET /api/v1/trainings/${COURSE}/versions/`]: Response.json(page([])),
    ...extra,
  };
}
function imageFile() {
  return new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "certificate.png", {
    type: "image/png",
  });
}
async function pickCertificateDay(user: UserEvent, dialog: Dialog, [label, iso]: [string, string]) {
  await user.click(dialog.getByRole("button", { name: new RegExp(label) }));
  const cell = await waitFor(() => {
    const found = document.querySelector<HTMLElement>(`[data-day="${iso}"] button`);
    if (!found) throw new Error(`day ${iso} not shown`);
    return found;
  });
  await user.click(cell);
}
async function fillCertificateFields(user: UserEvent, dialog: Dialog) {
  await user.click(await dialog.findByRole("combobox", { name: "Versión del curso" }));
  await user.click(await screen.findByRole("option", { name: /Synthetic course/ }));
  await pickCertificateDay(user, dialog, ["Inicio incluido", "2026-11-09"]);
  await pickCertificateDay(user, dialog, ["Fin excluido", "2026-11-10"]);
  await user.upload(dialog.getByLabelText("Imagen de la certificación"), imageFile());
  await user.click(dialog.getByRole("button", { name: "Cargar y verificar imagen" }));
  await dialog.findByText(/Imagen verificada/);
  for (const [label, value] of Object.entries(TEXT_FIELDS)) {
    await user.click(dialog.getByRole("textbox", { name: label }));
    await user.paste(value);
  }
}
async function fillCertificate() {
  const user = userEvent.setup({ delay: null });
  await user.click(await screen.findByRole("button", { name: "Registrar certificación" }));
  const dialog = within(screen.getByRole("dialog"));
  await fillCertificateFields(user, dialog);
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
    routes: certificateRoutes({
      [`POST /api/v1/users/${SUBJECT}/trainings/`]: Response.json(savedReceipt(), { status: 201 }),
    }),
  });
  const { user, dialog } = await fillCertificate();
  const submit = dialog.getByRole("button", { name: "Registrar certificación" });
  await user.click(submit);
  await dialog.findByText("Registro guardado.");
  submit.focus();
  await user.keyboard("{Enter}{Enter}");
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
});

test("a certificate response from an earlier session revision keeps the draft and requires deliberate review", async () => {
  const reply = deferred<Response>();
  const { api } = await openTrainings({
    path: `/people/trainings?subject=${SUBJECT}&center=${CENTER}`,
    routes: certificateRoutes({
      [`POST /api/v1/users/${SUBJECT}/trainings/`]: () => reply.promise,
    }),
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
  expect(dialog.queryByText("Registro guardado.")).toBeNull();
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
    routes: certificateRoutes({
      [`POST /api/v1/users/${SUBJECT}/trainings/`]: apiError(400, "validation_error"),
    }),
  });
  const user = userEvent.setup({ delay: null });
  await user.click(await screen.findByRole("button", { name: "Registrar certificación" }));
  const dialog = within(screen.getByRole("dialog"));
  await user.click(dialog.getByRole("button", { name: "Registrar certificación" }));
  expect(dialog.getByText("Revisa los campos indicados.")).toBeDefined();
  expect(app.api.requests.filter((request) => request.method === "POST")).toHaveLength(0);
  await fillCertificateFields(user, dialog);
  await user.click(dialog.getByRole("button", { name: "Registrar certificación" }));
  expect(await dialog.findByText(/No pudimos confirmar el registro/)).toBeDefined();
  for (const [label, value] of Object.entries(TEXT_FIELDS))
    expect(dialog.getByRole<HTMLInputElement>("textbox", { name: label }).value).toBe(value);
  expect(dialog.getByRole("combobox", { name: "Versión del curso" }).textContent).toContain(
    "Synthetic course",
  );
  expect(app.api.requests.filter((request) => request.method === "POST")[0]?.body).toMatchObject({
    center: CENTER,
    quadrant: null,
    training_version: VERSION,
    valid_from: "2026-11-09T06:00:00.000Z",
    valid_to: "2026-11-11T05:59:00.000Z",
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
  expect(api.requests.some((request) => request.path.includes(`/users/${SUBJECT}`))).toBe(false);
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
    routes: certificateRoutes({
      [`POST /api/v1/users/${SUBJECT}/trainings/`]: () => reply.promise,
    }),
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
  expect(dialog.queryByText("Registro guardado.")).toBeNull();
  await user.click(dialog.getByRole("button", { name: "Registrar certificación" }));
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
});
