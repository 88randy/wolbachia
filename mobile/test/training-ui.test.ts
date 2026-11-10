import assert from "node:assert/strict";
import { test } from "node:test";
import { messages, type Locale } from "@wolbachia/i18n";
import { darkTheme, lightTheme } from "@wolbachia/tokens";
import { readEvaluation } from "../src/features/training/contract.ts";
import {
  trainingCertificate,
  trainingEligibility,
  trainingEvaluation,
} from "./training-fixtures.ts";
import { componentHarness, flattenStyle } from "./support/m-09-render.ts";
import type { RenderNode } from "./support/m-09-render.ts";

type Render = ReturnType<typeof componentHarness>["render"];
function textParts(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((part: unknown) => textParts(part));
  return typeof value === "string" ? [value] : [];
}
function assertCard(nodes: readonly RenderNode[], expected: readonly string[], surface: string) {
  const copy = nodes
    .filter((node) => node.type === "Text")
    .flatMap((node) => textParts(node.props.children));
  expected.forEach((value) => {
    assert.ok(copy.includes(value), value);
  });
  assert.ok(
    nodes.some((node) => node.type === "Svg"),
    "status has an icon as well as text",
  );
  assert.equal(flattenStyle(nodes[0]?.props.style).backgroundColor, surface);
  for (const node of nodes.filter((candidate) => candidate.type === "Text")) {
    assert.equal(node.props.numberOfLines, undefined);
    assert.notEqual(node.props.allowFontScaling, false);
    assert.ok(Number(flattenStyle(node.props.style).fontSize) >= 12);
  }
}
function assertTrainingCards(render: Render, locale: Locale, surface: string) {
  const common = { now: new Date("2026-11-10T00:00:00Z"), timeZone: "America/Mexico_City" };
  assertCard(
    render("mobile/src/features/training/QualificationCard.tsx", "QualificationCard", {
      ...common,
      row: trainingEligibility(),
    }),
    [messages[locale]["trainings.mobile.expired"], messages[locale]["trainings.mobile.boundary"]],
    surface,
  );
  const certificate = trainingCertificate();
  assertCard(
    render("mobile/src/features/training/CertificationCard.tsx", "CertificationCard", {
      ...common,
      row: certificate,
    }),
    [
      messages[locale]["trainings.field.trainingVersion"],
      certificate.training_version_id,
      messages[locale]["trainings.mobile.expired"],
    ],
    surface,
  );
  const feedback = readEvaluation(trainingEvaluation());
  assertCard(
    render("mobile/src/features/training/EvaluationCard.tsx", "EvaluationCard", {
      ...common,
      row: feedback,
    }),
    [
      messages[locale]["trainings.mobile.voided"],
      "Retained improvement feedback",
      "Original observation corrected",
      messages[locale]["trainings.mobile.author"],
    ],
    surface,
  );
}
void test("P30 host props retain expired status, certificate identity and evaluation observations in both languages/themes at130percent", () => {
  for (const locale of ["es-MX", "en"] as const)
    for (const scheme of ["light", "dark"] as const) {
      const render = componentHarness({ locale, scheme, fontScale: 1.3 }).render;
      assertTrainingCards(
        render,
        locale,
        (scheme === "dark" ? darkTheme : lightTheme).color.surface,
      );
    }
});
