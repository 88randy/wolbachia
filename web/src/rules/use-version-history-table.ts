import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useFormatDateTime } from "../format/use-format-date-time";
import { useVoidReasonLabel, voidInfoOf } from "../void";
import { useVersionsQuery } from "./use-versions-query";
import type { RuleParameter, RuleParameterVersion } from "./rules-query";
import { VERSIONS_PAGE_SIZE, VERSIONS_TABLE } from "./rules-table";
import { RULE_HISTORY_NOTE_ID } from "./history-ids";
import { useAuthorName } from "./use-author-name";
import { useVersionColumns } from "./use-version-columns";
export interface VersionHistoryTableProps {
  parameter: RuleParameter;
  canVoid: boolean;
  onVoid: (version: RuleParameterVersion) => void;
}
/** Preserve URL filters, server pagination and the existing void provenance format. */
export function useVersionHistoryTable({ parameter, canVoid, onVoid }: VersionHistoryTableProps) {
  const controller = useTableUrlState(VERSIONS_TABLE);
  const query = useVersionsQuery(parameter.key, controller.state);
  const columns = useVersionColumns({
    parameter,
    canVoid,
    onVoid,
    blockedNoteId: RULE_HISTORY_NOTE_ID,
  });
  const authorName = useAuthorName();
  const formatWhen = useFormatDateTime();
  const reasonLabel = useVoidReasonLabel();
  const data = pageTableData(query, controller.state.page, VERSIONS_PAGE_SIZE);
  const voidOf = (version: RuleParameterVersion) =>
    voidInfoOf(version, () => authorName(version.voided_by_username), { formatWhen, reasonLabel });
  return { controller, columns, data, voidOf };
}
