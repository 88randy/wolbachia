import type { TableData } from "../data-table/table-types";
import type { RuleParameterVersion } from "./rules-query";

export interface VersionRows {
  data: TableData<RuleParameterVersion>;
  /** Voided versions left out of the page in view (0 when they are included). */
  hiddenCount: number;
}

/**
 * "Include voided" for the history. `GET .../versions/` always returns voided versions (decision
 * 42: the history is complete) and has no `include_voided` parameter, so without the toggle the
 * voided ones of the page in view are left out here. Paging stays the server's: the total and the
 * way to the next page are NOT changed (subtracting would make a page unreachable), and the
 * screen says how many were hidden on this page. The proper fix is the server filter (#88).
 */
export function hideVoidedVersions(
  data: TableData<RuleParameterVersion>,
  includeVoided: boolean,
): VersionRows {
  if (includeVoided) return { data, hiddenCount: 0 };
  const rows = data.rows.filter((version) => version.status !== "voided");
  return { data: { ...data, rows }, hiddenCount: data.rows.length - rows.length };
}
