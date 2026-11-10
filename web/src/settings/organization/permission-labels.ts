import type { MessageKey } from "@wolbachia/i18n";
import type { TFunction } from "i18next";

/** Module of each permission resource, for the grouped matrix. */
const GROUPS: Record<string, string> = {
  incident: "operation",
  shift: "operation",
  review_item: "operation",
  relocation: "operation",
  quadrant: "operation",
  ovitrap: "operation",
  sampling_point: "operation",
  schedule: "operation",
  field: "operation",
  field_event: "operation",
  release: "operation",
  permit: "operation",
  community_activity: "operation",
  intervention: "operation",
  removal: "operation",
  reading: "operation",
  risk_import: "operation",
  notification: "operation",
  notification_preference: "operation",
  home: "operation",
  bag: "laboratory",
  egg_count: "laboratory",
  egg_paddle: "laboratory",
  recount: "laboratory",
  sample: "laboratory",
  lab_method: "laboratory",
  lab_rejection: "laboratory",
  inventory: "inventory",
  lot: "inventory",
  location: "inventory",
  supply_type: "inventory",
  supplies: "inventory",
  supply_assignment: "inventory",
  transfer: "inventory",
  transfer_authorization: "inventory",
  discrepancy: "inventory",
  condition: "inventory",
  motorcycle: "fleet",
  user: "people",
  training: "people",
  evaluation: "people",
  access_log: "regulatory",
  arco_request: "regulatory",
  export: "regulatory",
  portal: "regulatory",
  organization: "administration",
  organizations: "administration",
  role: "administration",
  center: "administration",
  device: "administration",
  catalog: "administration",
  catalog_item: "administration",
  rule_parameter: "administration",
  rule_parameter_version: "administration",
};

export const PERMISSION_GROUP_ORDER = [
  "operation",
  "laboratory",
  "inventory",
  "fleet",
  "people",
  "regulatory",
  "administration",
  "other",
] as const;

function split(code: string): [string, string] {
  const dot = code.indexOf(".");
  return dot < 0 ? [code, ""] : [code.slice(0, dot), code.slice(dot + 1)];
}

/** Module of a permission code ("incident.close" → "operation"). */
export function permissionGroup(code: string): string {
  return GROUPS[split(code)[0]] ?? "other";
}

/** Human label of a permission code: "incident.close" → "Cerrar incidentes". Never the code. */
export function permissionLabel(
  code: string,
  t: TFunction,
  exists: (key: string) => boolean,
): string {
  const [resource, action] = split(code);
  const verb = `perm.verb.${action}`;
  const object = `perm.object.${resource}`;
  const verbText = exists(verb) ? t(verb as MessageKey) : "";
  const objectText = exists(object) ? t(object as MessageKey) : "";
  const text = `${verbText} ${objectText}`.trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : t("perm.group.other");
}
