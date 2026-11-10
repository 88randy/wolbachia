import { expect, test } from "vitest";
import { makeMe } from "../../test/fake-api";
import {
  canPublishTraining,
  hasTrainingScope,
  certificationBody,
  trainingVersionBody,
} from "./training-input";

test("global publication requires explicit all in both scope dimensions", () => {
  const me = makeMe({
    permissions: ["training.manage"],
    scope: {
      centers: { mode: "all", ids: [] },
      quadrants: { mode: "selected", ids: [] },
    },
  });
  expect(hasTrainingScope(me)).toBe(true);
  expect(canPublishTraining(me)).toBe(false);
  expect(
    canPublishTraining({
      ...me,
      scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
    }),
  ).toBe(true);
});
test("course publication keeps explicit seconds and exact action keys without a validity default", () => {
  const body = trainingVersionBody(
    {
      validity_seconds: "3600",
      enabled_actions: "release.record, ovitrap.place",
      effective_from: "2026-11-09T12:00:00Z",
    },
    7,
  );
  expect(body).toMatchObject({
    validity_seconds: 3600,
    enabled_actions: ["release.record", "ovitrap.place"],
    effective_from: "2026-11-09T12:00:00Z",
    expected_revision: 7,
  });
});
test("certifications retain explicit half-open instants and verified evidence references", () => {
  const body = certificationBody({
    center: "center-id",
    quadrant: "",
    training_version: "version-id",
    valid_from: "2026-11-09T12:00:00Z",
    valid_to: "2026-11-10T12:00:00Z",
    evidence_ids: "first-id,second-id",
    issuer_reference: "Synthetic issuer",
    attestation: "Synthetic attestation",
  });
  expect(body).toMatchObject({
    center: "center-id",
    quadrant: null,
    training_version: "version-id",
    valid_from: "2026-11-09T12:00:00Z",
    valid_to: "2026-11-10T12:00:00Z",
    evidence_ids: ["first-id", "second-id"],
    expected_revision: 0,
  });
});
