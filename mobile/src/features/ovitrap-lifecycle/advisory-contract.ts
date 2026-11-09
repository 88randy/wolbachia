import type { Schemas } from "@wolbachia/api-client";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  CourierContractError,
  choice,
  readRecord,
  readInstant,
  readUuid,
  readString,
} from "./contract-readers.ts";
import type { CurrentLifecycleDraft } from "./types.ts";
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
/** Same sorted-key compact Unicode JSON as core.snapshots; all numeric advisory fields are integers. */
export function advisoryHash(value: unknown): string {
  return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(canonical(value)))));
}
function hash(value: unknown): string {
  const text = readString(value);
  if (!/^[0-9a-f]{64}$/.test(text)) throw new CourierContractError();
  return text;
}
function parameter(value: unknown, maximum: number): Schemas["AdvisoryRuleVersion"] {
  const row = readRecord(value);
  if (
    typeof row.value !== "number" ||
    !Number.isInteger(row.value) ||
    row.value < 1 ||
    row.value > maximum
  )
    throw new CourierContractError();
  return {
    version_id: readUuid(row.version_id),
    value: row.value,
    effective_from: readInstant(row.effective_from),
  };
}
function ruleContext(value: unknown): Schemas["AdvisoryRuleContext"] {
  const row = readRecord(value),
    parameters = readRecord(row.parameters);
  return {
    timezone: readString(row.timezone),
    epi_week: choice(["iso", "mmwr"])(row.epi_week),
    parameters: {
      closed_house_weeks_to_relocate: parameter(parameters.closed_house_weeks_to_relocate, 8),
      incidents_to_relocate: parameter(parameters.incidents_to_relocate, 10),
    },
  };
}
function weeks(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 8) throw new CourierContractError();
  const result = value.map(readString);
  if (
    new Set(result).size !== result.length ||
    result.some((label) => !/^\d{4}-W\d{2}$/.test(label))
  )
    throw new CourierContractError();
  return result;
}
function available(row: Record<string, unknown>) {
  const context = ruleContext(row.rule_context),
    required = weeks(row.required_epi_weeks),
    observed = weeks(row.observed_closed_house_weeks);
  if (
    row.unavailable_reason !== null ||
    hash(row.rule_context_version) !== advisoryHash(row.rule_context) ||
    required.length !== context.parameters.closed_house_weeks_to_relocate.value
  )
    throw new CourierContractError();
  if (
    observed.join() !== required.filter((label) => observed.includes(label)).join() ||
    typeof row.incident_count !== "number" ||
    !Number.isSafeInteger(row.incident_count) ||
    row.incident_count < 0
  )
    throw new CourierContractError();
  if (
    row.suggested !==
    (observed.length === required.length ||
      row.incident_count >= context.parameters.incidents_to_relocate.value)
  )
    throw new CourierContractError();
  return {
    rule_context: context,
    required_epi_weeks: required,
    observed_closed_house_weeks: observed,
  };
}
/** This validates an observed aggregate, never local incident counts or a current capture grant. */
export function readAdvisory(value: unknown): Schemas["OvitrapAdvisory"] {
  const row = readRecord(value),
    { version, ...content } = row;
  if (row.schema_version !== 1 || hash(version) !== advisoryHash(content))
    throw new CourierContractError();
  readUuid(row.physical_ovitrap_id);
  readUuid(row.point_id);
  readInstant(row.as_of);
  const state = choice(["available", "unavailable"])(row.state);
  if (state === "available") available(row);
  else unavailableContent(row);
  return row as unknown as Schemas["OvitrapAdvisory"];
}
function sameParameter(
  actual: Schemas["AdvisoryRuleVersion"],
  expected:
    | Pick<Schemas["SnapshotParameter"], "version_id" | "value" | "effective_from">
    | null
    | undefined,
) {
  return (
    expected !== null &&
    expected !== undefined &&
    typeof expected.effective_from === "string" &&
    actual.version_id === expected.version_id &&
    actual.value === expected.value &&
    Date.parse(actual.effective_from) === Date.parse(expected.effective_from)
  );
}
export function matchesAdvisory(
  body: Schemas["OvitrapAdvisory"],
  draft: CurrentLifecycleDraft,
): boolean {
  if (
    body.physical_ovitrap_id !== draft.ovitrapId ||
    body.point_id !== draft.point.id ||
    Date.parse(body.as_of) !== Date.parse(draft.deviceTime)
  )
    return false;
  if (body.state === "unavailable") return true;
  return matchesRuleContext(body, draft);
}
function matchesRuleContext(
  body: Schemas["OvitrapAdvisory"],
  draft: CurrentLifecycleDraft,
): boolean {
  const context = body.rule_context,
    original = draft.rules?.relocationParameters;
  return (
    context !== null &&
    context.timezone === draft.source.organization.timezone &&
    context.epi_week === draft.source.organization.epi_week &&
    sameParameter(context.parameters.closed_house_weeks_to_relocate, original?.closedHouseWeeks) &&
    sameParameter(context.parameters.incidents_to_relocate, original?.incidents)
  );
}

function unavailableContent(row: Record<string, unknown>): void {
  choice(["future_cutoff", "rule_context_unavailable", "organization_context_unavailable"])(
    row.unavailable_reason,
  );
  for (const key of [
    "rule_context",
    "rule_context_version",
    "required_epi_weeks",
    "observed_closed_house_weeks",
    "incident_count",
    "suggested",
  ])
    if (row[key] !== null) throw new CourierContractError();
}
