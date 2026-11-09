import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Select } from "../forms/Select";
import { TextField } from "../forms/TextField";
import { ErrorState } from "../ui/ErrorState";
import type { TableController } from "../data-table/table-types";
import type { IncidentScope } from "./incidents-query";
import { incidentContextOptions } from "./incident-options-query";
import { IncidentOptionPaging } from "./IncidentOptionPaging";
function contextValue(filters: Readonly<Record<string, string>>, activeCenter?: string) {
 const center = filters["center"];
 const quadrant = filters["quadrant"];
 return center || quadrant ? JSON.stringify([center ?? activeCenter, quadrant ?? null]) : "";
}
export function IncidentContextFilter({ scope, controller }: { scope: IncidentScope; controller: TableController }) {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [page, setPage] = useState(1);
 const [search, setSearch] = useState("");
 const query = useQuery(incidentContextOptions(scope, { page, search }));
 const value = contextValue(controller.state.filters, scope.identity.activeCenter);
 const pairs = query.data?.results ?? [];
 const options = pairs.map(pair => ({ value: JSON.stringify([pair.center_id, pair.quadrant_id]), label: `${pair.center_code} · ${pair.center_name}${pair.quadrant_code ? ` · ${pair.quadrant_code}` : ""}` }));
 if (value && !options.some(option => option.value === value)) options.unshift({ value, label: t("incidents.workspace.selectedContext") });
 const select = (next: string) => {
 const pair = pairs.find(pair => JSON.stringify([pair.center_id, pair.quadrant_id]) === next);
 void navigate({ to: ".", search: previous => ({ ...previous, center: pair?.center_id, quadrant: pair?.quadrant_id ?? undefined, page: undefined }) });
 };
 return <div>
 <TextField id="incident-context-search" label={t("incidents.workspace.contextSearch")} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
 <Select id="incident-context-filter" label={t("incidents.workspace.context")} value={value} options={[{ value: "", label: t("incidents.workspace.sessionContext") }, ...options]} disabled={query.isFetching} onChange={event => { select(event.target.value); }} />
 {query.isError && <ErrorState onRetry={() => { void query.refetch(); }} />}
 <IncidentOptionPaging page={page} hasNext={Boolean(query.data?.next) && !query.isFetching} onPage={setPage} />
 </div>;
}
