import type { Schemas } from "@wolbachia/api-client";
import type { PersonContext } from "./person-context";
import type { TrainingDraft } from "./training-input";
import { splitValues, UUID_PATTERN, valueOf } from "./training-input";
import type { TrainingField } from "./training-fields";
export const REQUIREMENT_FIELDS: TrainingField[] = [
  { key: "action", label: "trainings.field.action" },
  { key: "training", label: "trainings.field.training", kind: "uuid" },
  { key: "versions", label: "trainings.field.acceptableVersions", kind: "uuids" },
  {
    key: "effective_from",
    label: "trainings.field.effective",
    kind: "instant",
    hint: "trainings.field.instantHint",
  },
];
export function requirementBody(
  draft: TrainingDraft,
  frame: { context: PersonContext; revision: number; existing?: unknown },
): Schemas["RequirementWriteRequest"] {
  return {
    command_id: crypto.randomUUID(),
    expected_revision: frame.revision,
    center: frame.context.center,
    quadrant: frame.context.quadrant || null,
    effective_from: valueOf(draft, "effective_from"),
    acceptable_versions: {
      ...preservedRequirementPins(frame.existing),
      [valueOf(draft, "training")]: splitValues(valueOf(draft, "versions")),
    },
  };
}
function preservedRequirementPins(value: unknown): Record<string, string[]> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Unsupported requirement pins");
  const entries = Object.entries(value).map(([training, versions]): [string, string[]] => {
    if (
      !UUID_PATTERN.test(training) ||
      !Array.isArray(versions) ||
      versions.length === 0 ||
      !versions.every(
        (version): version is string => typeof version === "string" && UUID_PATTERN.test(version),
      )
    )
      throw new Error("Unsupported requirement pins");
    return [training, [...versions]];
  });
  return Object.fromEntries(entries);
}
export function requirementPins(value: unknown, label: (id: string) => string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return Object.entries(value)
    .flatMap(([, versions]) =>
      Array.isArray(versions)
        ? versions.filter((version): version is string => typeof version === "string").map(label)
        : [],
    )
    .join("; ");
}
