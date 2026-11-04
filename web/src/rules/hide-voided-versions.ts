import type { TableData } from "../data-table/table-types";
import type { RuleParameterVersion } from "./rules-query";

/**
 * "Include voided" for the history. `GET .../versions/` always returns voided versions (decision
 * 42: the history is complete) and has no `include_voided` parameter, so without the toggle the
 * voided ones of the page in view are left out here and the total is reduced by them. Past one
 * page the total only counts the voided versions of this page; a parameter would need over
 * `VERSIONS_PAGE_SIZE` versions for that to show.
 */
export function hideVoidedVersions(
  data: TableData<RuleParameterVersion>,
  includeVoided: boolean,
): TableData<RuleParameterVersion> {
  if (includeVoided) return data;
  const rows = data.rows.filter((version) => version.status !== "voided");
  const { paging } = data;
  if (paging?.mode !== "page") return { ...data, rows };
  const hidden = data.rows.length - rows.length;
  return { ...data, rows, paging: { ...paging, count: paging.count - hidden } };
}
