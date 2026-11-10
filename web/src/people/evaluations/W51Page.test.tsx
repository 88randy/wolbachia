import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { apiError } from "../../test/fake-api";
import { makeOrganization } from "../../test/fake-api";
import { bumpEpoch, currentRevision } from "../../session/session-revision";
import {
  openEvaluations,
  fillEvaluation,
  submitEvaluation,
  receipt,
  ID,
  PERSON,
  VERSION,
  OLD_VERSION,
  OBSERVED,
  ME,
  EVALUATION,
  page,
} from "./evaluation-test-helpers";

test.each([
  ["pass", "99.1234", "Aprobada"],
  ["low", "62.1256", "Resultado bajo"],
  ["critical_failure", "99.0000", "Falla crítica de seguridad"],
  ["incomplete", null, "Incompleta"],
] as const)(
  "renders the authoritative %s without client rescoring missing answers",
  async (outcome, score, label) => {
    const { api } = await openEvaluations({
      routes: {
        "POST /api/v1/evaluations/": Response.json(receipt(outcome, score), { status: 201 }),
      },
    });
    const { form } = await submitEvaluation();
    const saved = await form.findByText("El servidor registró la evaluación.");
    const result = within(saved.closest('[role="status"]') as HTMLElement);
    expect(result.getByText(label)).toBeDefined();
    if (score) expect(result.getByText(score)).toBeDefined();
    expect(api.requests.find((request) => request.method === "POST")?.body).toMatchObject({
      expected_revision: 0,
      subject: PERSON,
      center: ID,
      quadrant: null,
      rubric_version: VERSION,
      observed_at: OBSERVED,
      section_scores: { presentation: "80", execution: null, coverage: "50" },
      critical_responses: { safety: null },
    });
  },
);

test("keyboard validation retains fields and confirmation returns focus without sending", async () => {
  const { api } = await openEvaluations();
  const { user, form } = await fillEvaluation();
  await user.clear(form.getByRole("textbox", { name: "Persona (UUID)" }));
  const trigger = form.getByRole("button", { name: "Revisar y guardar" });
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(await screen.findByRole("alert")).toBeDefined();
  expect(form.getByRole<HTMLInputElement>("spinbutton", { name: "Presentación" }).value).toBe("80");
  await user.click(form.getByRole("textbox", { name: "Persona (UUID)" }));
  await user.paste(PERSON);
  await user.click(trigger);
  expect(document.activeElement).toBe(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }),
  );
  await user.keyboard("{Escape}");
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  expect(document.activeElement).toBe(trigger);
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(0);
});

test("a failed immutable command retains input and needs deliberate review before another send", async () => {
  const { api } = await openEvaluations({
    routes: { "POST /api/v1/evaluations/": apiError(400, "validation_error") },
  });
  const { user, form } = await submitEvaluation();
  await form.findByText(/No pudimos confirmar el registro/);
  expect(form.getByRole<HTMLInputElement>("textbox", { name: "Persona (UUID)" }).value).toBe(
    PERSON,
  );
  await user.click(form.getByRole("button", { name: "Revisar y guardar" }));
  expect(api.requests.filter((request) => request.method === "POST")).toHaveLength(1);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("a create-only user sees their receipt but never reads private history or notice information", async () => {
  const { api } = await openEvaluations({ permissions: ["evaluation.create"] });
  await submitEvaluation();
  await screen.findByText("El servidor registró la evaluación.");
  expect(
    api.requests.some(
      (request) => request.path.startsWith("/api/v1/evaluations/") && request.method === "GET",
    ),
  ).toBe(false);
  expect(screen.queryByRole("region", { name: "Aviso a recursos humanos" })).toBeNull();
});

test("history retains old rubric identity, raw critical observation and truthful unavailable notice", async () => {
  const { api } = await openEvaluations({
    permissions: ["evaluation.read"],
    path: `/people/evaluations?item=${ID}&include_voided=true`,
    routes: {
      "GET /api/v1/evaluations/": Response.json(
        page([
          {
            ...EVALUATION,
            is_voided: true,
            void: {
              id: VERSION,
              evaluation_id: ID,
              attempt_id: ID,
              revision: 2,
              reason_code: "other",
              reason: "Synthetic retained void reason",
              created_at: OBSERVED,
              created_by: PERSON,
            },
          },
        ]),
      ),
    },
  });
  const history = await screen.findByRole("region", { name: "Historial de evaluaciones" });
  expect(await within(history).findByText(OLD_VERSION)).toBeDefined();
  expect(within(history).getByText(/Synthetic retained void reason/)).toBeDefined();
  const attempts = await screen.findByRole("region", { name: "Intentos conservados" });
  expect(await within(attempts).findByText("72.1234")).toBeDefined();
  expect(within(attempts).getByText("Falla crítica de seguridad")).toBeDefined();
  expect(screen.getByText(/todavía no permite consultar el recibo/)).toBeDefined();
  expect(screen.queryByRole("region", { name: "Nueva evaluación" })).toBeNull();
  expect(
    api.requests.find((request) => request.path.startsWith("/api/v1/evaluations/?"))?.path,
  ).toContain("include_voided=true");
});

test("a scope change denies a foreign contextual deep link and removes obsolete private cache", async () => {
  const app = await openEvaluations({ path: `/people/evaluations?center=${ID}` });
  await screen.findByText(OLD_VERSION);
  app.api.setRoute(
    "GET /api/v1/me/",
    Response.json({
      ...ME,
      scope: { centers: { mode: "selected", ids: [PERSON] }, quadrants: { mode: "all", ids: [] } },
    }),
  );
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  await screen.findByText(/No tienes acceso a este contexto/);
  expect(screen.queryByText(OLD_VERSION)).toBeNull();
  expect(
    app.queryClient
      .getQueryCache()
      .findAll()
      .some((query) => query.queryKey[3] === "evaluations"),
  ).toBe(false);
});

test("late mutation success cannot publish or invalidate after a different organization is accepted", async () => {
  let release!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const app = await openEvaluations({ routes: { "POST /api/v1/evaluations/": () => pending } });
  await submitEvaluation();
  app.api.setRoute(
    "GET /api/v1/me/",
    Response.json({ ...ME, organization: makeOrganization("other", "Synthetic other") }),
  );
  await act(async () => {
    bumpEpoch();
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  const revision = currentRevision();
  await waitFor(() => {
    expect(app.queryClient.isFetching()).toBe(0);
  });
  const reads = app.api.requests.length;
  await act(async () => {
    release(Response.json(receipt("pass", "100"), { status: 201 }));
    await pending;
  });
  expect(screen.queryByText("El servidor registró la evaluación.")).toBeNull();
  expect(app.api.requests.length).toBe(reads);
  expect(currentRevision()).toBe(revision);
});

test("a foreign quadrant without a center is denied before any private list or attempt request", async () => {
  const app = await openEvaluations({
    path: `/people/evaluations?quadrant=${PERSON}&item=${ID}`,
    isDenied: true,
    routes: {
      "GET /api/v1/me/": Response.json({
        ...ME,
        scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "selected", ids: [ID] } },
      }),
    },
  });
  expect(app.api.requests.some((request) => request.path.startsWith("/api/v1/evaluations/"))).toBe(
    false,
  );
  expect(screen.queryByRole("region", { name: "Nueva evaluación" })).toBeNull();
});

test("an authorized empty notice-policy page exposes missing recipient configuration without claiming delivery", async () => {
  const { api } = await openEvaluations({ permissions: ["evaluation.read", "training.manage"] });
  const notice = await screen.findByRole("region", { name: "Aviso a recursos humanos" });
  expect(await within(notice).findByText(/No hay configuración de destinatario/)).toBeDefined();
  expect(
    api.requests.some((request) => request.path.startsWith("/api/v1/evaluation-notice-policy/")),
  ).toBe(true);
  expect(
    api.requests.some(
      (request) => request.path.includes("memberships") || request.path.includes("roles"),
    ),
  ).toBe(false);
});

test("a denied observation retires private draft fields instead of retaining an inaccessible subject", async () => {
  await openEvaluations({ routes: { "POST /api/v1/evaluations/": apiError(404, "not_found") } });
  const { form } = await submitEvaluation();
  await form.findByText(/No pudimos confirmar el registro/);
  expect(form.getByRole<HTMLInputElement>("textbox", { name: "Persona (UUID)" }).value).toBe("");
  expect(form.getByRole<HTMLInputElement>("spinbutton", { name: "Presentación" }).value).toBe("");
});

test("a create-only permission cannot open an evaluation history deep link", async () => {
  const { api } = await openEvaluations({
    permissions: ["evaluation.create"],
    path: `/people/evaluations?item=${ID}`,
    isDenied: true,
  });
  expect(api.requests.some((request) => request.path.startsWith("/api/v1/evaluations/"))).toBe(
    false,
  );
});

test("scope broadening keeps permitted RAM input while fencing the previous authorization entry", async () => {
  let release!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const app = await openEvaluations({
    routes: {
      "GET /api/v1/me/": Response.json({
        ...ME,
        scope: { centers: { mode: "selected", ids: [ID] }, quadrants: { mode: "none", ids: [] } },
      }),
      "POST /api/v1/evaluations/": () => pending,
    },
  });
  const { form } = await submitEvaluation();
  app.api.setRoute("GET /api/v1/me/", Response.json(ME));
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  expect(form.getByRole<HTMLInputElement>("textbox", { name: "Persona (UUID)" }).value).toBe(
    PERSON,
  );
  await act(async () => {
    release(Response.json(receipt("pass", "100"), { status: 201 }));
    await pending;
  });
  expect(screen.queryByText("El servidor registró la evaluación.")).toBeNull();
  expect(form.getByRole<HTMLInputElement>("spinbutton", { name: "Presentación" }).value).toBe("80");
  expect(form.getByText(/No pudimos confirmar el registro/)).toBeDefined();
});
