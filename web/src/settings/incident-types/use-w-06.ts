import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { useSessionIdentity } from "../../session/use-session-identity";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import type { TableQueryConfig } from "../../data-table/table-types";
import {
  TYPE_PAGE_SIZE,
  typesOptions,
  typeOptions,
  unconfiguredOptions,
} from "./incident-types-query";
import { useTypeNavigation } from "./use-type-navigation";
import { TYPE_CODE_MAX_LENGTH } from "./type-limits";
export const TYPES_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: TYPE_PAGE_SIZE,
  filters: [
    {
      key: "code",
      kind: "text",
      labelKey: "incidentTypes.field.code",
      maxLength: TYPE_CODE_MAX_LENGTH,
    },
  ],
  sortableIds: ["code", "created_at"],
  defaultOrdering: "code",
  supportsVoided: false,
};
const URL_SCOPE = {
  ignoredPrefixes: ["editor", "create", "configure", "unconfigured_", "history_"],
};
/** URL owns server paging and selected human codes; session context owns each query. */
export function useW06() {
  const navigation = useTypeNavigation();
  const scope = { client: useApiClient(), identity: useSessionIdentity() };
  const controller = useTableUrlState(TYPES_TABLE, URL_SCOPE);
  const query = useQuery(typesOptions(scope, controller.state));
  const selected = useQuery(typeOptions(scope, navigation.editor || navigation.configurationCode));
  const options = unconfiguredOptions(scope, { code: navigation.configurationCode, page: 1 });
  const unconfigured = useQuery({
    ...options,
    enabled: options.enabled && Boolean(navigation.configurationCode),
  });
  return { scope, controller, query, selected, unconfigured, ...navigation };
}
