import assert from "node:assert/strict";
import { test } from "node:test";
import { messages, type Locale } from "@wolbachia/i18n";
import { darkTheme, lightTheme, type Theme } from "@wolbachia/tokens";
import { readEvaluation } from "../src/features/training/contract.ts";
import { trainingDate } from "../src/features/training/presentation.ts";
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
function assertCard(nodes: readonly RenderNode[], expected: readonly string[], theme: Theme) {
  const copy = nodes
    .filter((node) => node.type === "Text")
    .flatMap((node) => textParts(node.props.children));
  expected.forEach((value) => {
    assert.ok(copy.includes(value), value);
  });
  const icon = nodes.find((node) => node.type === "Svg");
  assert.ok(icon, "status has an icon as well as text");
  // The card takes its surface from the theme variables; the icon color comes from this theme.
  assert.ok(String(nodes[0]?.props.className).split(" ").includes("bg-surface"));
  assert.ok(Object.values(theme.color.status).some((status) => status.fg === icon.props.color));
  for (const node of nodes.filter((candidate) => candidate.type === "Text")) {
    assert.equal(node.props.numberOfLines, undefined);
    assert.notEqual(node.props.allowFontScaling, false);
    assert.ok(Number(flattenStyle(node.props.style).fontSize) >= 12);
  }
}
function assertTrainingCards(render: Render, locale: Locale, theme: Theme) {
  const common = { now: new Date("2026-11-10T00:00:00Z"), timeZone: "America/Mexico_City" };
  assertCard(
    render("mobile/src/features/training/QualificationCard.tsx", "QualificationCard", {
      ...common,
      row: trainingEligibility(),
    }),
    [messages[locale]["trainings.mobile.expired"], messages[locale]["trainings.mobile.boundary"]],
    theme,
  );
  const certificate = trainingCertificate();
  assertCard(
    render("mobile/src/features/training/CertificationCard.tsx", "CertificationCard", {
      ...common,
      row: certificate,
    }),
    // Dates in the organization's time zone; the courier sees no internal training-version id.
    [
      messages[locale]["trainings.mobile.expired"],
      `${messages[locale]["trainings.mobile.validFrom"]}: ${trainingDate(certificate.valid_from, locale, common.timeZone)}`,
      `${messages[locale]["trainings.mobile.validUntil"]}: ${trainingDate(certificate.valid_to, locale, common.timeZone)}`,
    ],
    theme,
  );
  const feedback = readEvaluation(trainingEvaluation());
  assertCard(
    render("mobile/src/features/training/EvaluationCard.tsx", "EvaluationCard", {
      ...common,
      row: feedback,
    }),
    [
      messages[locale]["trainings.mobile.voided"],
      `${messages[locale]["trainings.mobile.reason"]}: Retained improvement feedback`,
      `${messages[locale]["trainings.mobile.reason"]}: Original observation corrected`,
    ],
    theme,
  );
}
void test("P30 host props retain expired status, certificate identity and evaluation observations in both languages/themes at130percent", () => {
  for (const locale of ["es-MX", "en"] as const)
    for (const scheme of ["light", "dark"] as const) {
      const render = componentHarness({ locale, scheme, fontScale: 1.3 }).render;
      assertTrainingCards(render, locale, scheme === "dark" ? darkTheme : lightTheme);
    }
});
