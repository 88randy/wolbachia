import type { TableQueryConfig } from "../data-table/table-types";
import type { SessionIdentity } from "../session/org-scoped-query";
/** A filter only: backend grants remain authoritative; URL filters take precedence. */
export function centerQuery(identity: Pick<SessionIdentity, "activeCenter">, urlCenter?: string) {
  const center = urlCenter ?? identity.activeCenter;
  return center ? { center } : {};
}

/** Placeholder isolation follows the effective filter; authorization is unchanged. */
export function centerIdentity(identity: SessionIdentity, urlCenter?: string): SessionIdentity {
  return { ...identity, activeCenter: urlCenter ?? identity.activeCenter };
}

export const CENTER_FILTER = {
  key: "center",
  kind: "text",
  labelKey: "geography.field.center",
  maxLength: 36,
  input: "hidden",
} as const;
export const CENTER_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: 25,
  sortableIds: [],
  supportsVoided: false,
  filters: [CENTER_FILTER],
};
