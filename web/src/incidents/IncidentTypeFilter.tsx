import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Select } from "../forms/Select";
import { ErrorState } from "../ui/ErrorState";
import type { TableController } from "../data-table/table-types";
import type { IncidentScope } from "./incidents-query";
import { incidentTypeOptions } from "./incident-options-query";
import { IncidentOptionPaging } from "./IncidentOptionPaging";
export function IncidentTypeFilter({ scope, controller }: { scope: IncidentScope; controller: TableController }) {
 const { t } = useTranslation();
 const [page, setPage] = useState(1);
 const query = useQuery(incidentTypeOptions(scope, page));
 const value = controller.state.filters["type"] ?? "";
 const options = query.data?.results.map(type => ({ value: type.id, label: type.label })) ?? [];
 if (value && !options.some(option => option.value === value)) options.unshift({ value, label: t("incidents.workspace.selectedType") });
 return <div>
 <Select id="incident-type-filter" label={t("incidents.workspace.type")} value={value} options={[{ value: "", label: t("incidents.workspace.allTypes") }, ...options]} disabled={query.isFetching} onChange={event => { controller.setFilter("type", event.target.value || undefined); }} />
 {query.isError && <ErrorState onRetry={() => { void query.refetch(); }} />}
 <IncidentOptionPaging page={page} hasNext={Boolean(query.data?.next) && !query.isFetching} onPage={setPage} />
 </div>;
}
