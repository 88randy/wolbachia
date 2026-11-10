import type { Schemas } from "@wolbachia/api-client";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeApi, makeMe } from "../../test/fake-api";
import type { FakeApiRoutes } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
export const ID = "00000000-0000-4000-8000-000000000148";
export const PERSON = "00000000-0000-4000-8000-000000000149";
export const RUBRIC = "00000000-0000-4000-8000-000000000150";
export const VERSION = "00000000-0000-4000-8000-000000000151";
export const OLD_VERSION = "00000000-0000-4000-8000-000000000152";
export const OBSERVED = "2026-11-09T12:00:00-06:00";
export const ME = makeMe({
  permissions: ["evaluation.read", "evaluation.create"],
  scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
});
export const CURRENT_VERSION: Schemas["RubricVersionRead"] = {
  id: VERSION,
  rubric_id: RUBRIC,
  version: 2,
  weights: { presentation: 20, execution: 50, coverage: 30 },
  pass_threshold: "80.0000",
  critical_checks: ["safety"],
  effective_from: "2026-11-01T12:00:00Z",
  created_at: "2026-11-01T12:00:00Z",
};
export const ATTEMPT: Schemas["EvaluationAttemptRead"] = {
  id: ID,
  evaluation_id: ID,
  predecessor_id: null,
  revision: 1,
  observed_at: OBSERVED,
  section_scores: { presentation: "95", execution: "65", coverage: "80" },
  critical_responses: { safety: false },
  score: "72.1234",
  outcome: "critical_failure",
  created_at: OBSERVED,
  created_by: PERSON,
  completion_sequence: 2,
};
export const EVALUATION: Schemas["EvaluationRead"] = {
  id: ID,
  subject_id: PERSON,
  rubric_version_id: OLD_VERSION,
  center_id: ID,
  quadrant_id: null,
  created_at: OBSERVED,
  revision: 1,
  is_voided: false,
  current: ATTEMPT,
  void: null,
};
export function page<Row>(rows: Row[]) {
  return { count: rows.length, next: null, previous: null, results: rows };
}
export function receipt(
  outcome: Schemas["EvaluationOutcomeEnum"],
  score: string | null,
): Schemas["PeopleReceipt"] {
  return {
    command_id: ID,
    id: ID,
    revision: 1,
    recorded_at: OBSERVED,
    evaluation: {
      attempt_id: ID,
      rubric_version_id: VERSION,
      outcome,
      score,
      completion_sequence: score === null ? null : 3,
    },
  };
}
function evaluationRoutes(me: typeof ME, routes: FakeApiRoutes = {}) {
  return {
    "GET /api/v1/me/": Response.json(me),
    "GET /api/v1/centers/": Response.json(page([])),
    "GET /api/v1/evaluation-notice-policy/": Response.json(page([])),
    "GET /api/v1/evaluations/": Response.json(page([EVALUATION])),
    "GET /api/v1/evaluation-rubrics/": Response.json(
      page([
        {
          id: RUBRIC,
          code: "R-148",
          name: "Synthetic rubric",
          revision: 2,
          current_version_id: VERSION,
        },
      ]),
    ),
    [`GET /api/v1/evaluation-rubrics/${RUBRIC}/versions/`]: Response.json(page([CURRENT_VERSION])),
    [`GET /api/v1/evaluations/${ID}/attempts/`]: Response.json(page([ATTEMPT])),
    "POST /api/v1/evaluations/": Response.json(receipt("low", "62.1256"), { status: 201 }),
    ...routes,
  };
}
export async function openEvaluations(
  options: {
    routes?: FakeApiRoutes;
    path?: string;
    permissions?: string[];
    isDenied?: boolean;
  } = {},
) {
  const me = { ...ME, permissions: options.permissions ?? ME.permissions };
  const api = createFakeApi(evaluationRoutes(me, options.routes));
  const app = await renderApp({ path: options.path ?? "/people/evaluations", fetch: api.fetch });
  if (options.isDenied) await screen.findByText(/No tienes acceso a este contexto/);
  else await screen.findByRole("heading", { name: "Cédulas de evaluación" });
  return { ...app, api };
}
export async function fillEvaluation() {
  const user = userEvent.setup({ delay: null });
  await pasteText(user, screen.getByRole("textbox", { name: "Código exacto de rúbrica" }), "R-148");
  await user.click(screen.getByRole("button", { name: "Consultar rúbrica" }));
  await user.click(await screen.findByRole("button", { name: "Usar esta versión" }));
  const form = within(screen.getByRole("region", { name: "Nueva evaluación" }));
  await pasteText(user, form.getByRole("textbox", { name: "Persona (UUID)" }), PERSON);
  await pasteText(user, form.getByRole("textbox", { name: "Centro (UUID)" }), ID);
  await pasteText(
    user,
    form.getByRole("textbox", { name: "Fecha de observación con zona horaria" }),
    OBSERVED,
  );
  await user.type(form.getByRole("spinbutton", { name: "Presentación" }), "80");
  await user.type(form.getByRole("spinbutton", { name: "Cobertura" }), "50");
  return { user, form };
}
async function pasteText(
  user: ReturnType<typeof userEvent.setup>,
  field: HTMLElement,
  value: string,
) {
  await user.click(field);
  await user.paste(value);
}
export async function submitEvaluation() {
  const { user, form } = await fillEvaluation();
  await user.click(form.getByRole("button", { name: "Revisar y guardar" }));
  const dialog = within(screen.getByRole("dialog"));
  await user.click(dialog.getByRole("button", { name: "Guardar cédula" }));
  return { user, form };
}
