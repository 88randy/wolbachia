import { evaluationQuery, EVALUATION_TABLE } from "./evaluation-table";
import { readTableState } from "../../data-table/table-state";
import { expect, test } from "vitest";
import { evaluationBody, readRubric, isContextAllowed } from "./evaluation-domain";
import { makeMe } from "../../test/fake-api";

test("missing scores and unanswered critical checks remain null without local weighting", () => {
  const draft = {
    subject: "subject",
    center: "center",
    quadrant: "",
    observedAt: "2026-11-09T12:00:00Z",
    presentation: "90",
    execution: "",
    coverage: "50",
    critical: { safety: "" },
  };
  expect(evaluationBody(draft, "rubric", "command")).toEqual({
    command_id: "command",
    expected_revision: 0,
    subject: "subject",
    center: "center",
    quadrant: null,
    observed_at: "2026-11-09T12:00:00Z",
    rubric_version: "rubric",
    section_scores: { presentation: "90", execution: null, coverage: "50" },
    critical_responses: { safety: null },
  });
});

test("absent or malformed rubric configuration never fabricates the technical defaults", () => {
  expect(readRubric({ weights: null, critical_checks: [], pass_threshold: "80" })).toBeNull();
  expect(
    readRubric({
      weights: { presentation: 20, execution: 50, coverage: 30 },
      critical_checks: ["safety"],
      pass_threshold: "80.0000",
    }),
  ).toEqual({
    weights: { presentation: 20, execution: 50, coverage: 30 },
    checks: ["safety"],
    threshold: "80.0000",
  });
});

test("explicit scopes reject empty selected centers and foreign contextual deep links", () => {
  const scope = makeMe({
    scope: {
      centers: { mode: "selected", ids: ["center"] },
      quadrants: { mode: "selected", ids: ["quadrant"] },
    },
  }).scope;
  expect(isContextAllowed(scope, "center", "quadrant")).toBe(true);
  expect(isContextAllowed(scope, "center", "")).toBe(true);
  expect(isContextAllowed(scope, "foreign", "quadrant")).toBe(false);
  expect(isContextAllowed(scope, "center", "foreign")).toBe(false);
  expect(isContextAllowed({ ...scope, centers: { mode: "selected", ids: [] } }, "center", "")).toBe(
    false,
  );
});

test("an unset active center is omitted instead of sending an invalid blank UUID to B03", () => {
  const { state } = readTableState({}, EVALUATION_TABLE);
  expect(evaluationQuery(state, "").center).toBeUndefined();
});
