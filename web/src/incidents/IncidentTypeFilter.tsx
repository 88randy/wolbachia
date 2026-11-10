import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Select } from "../forms/Select";
import type { TableController } from "../data-table/table-types";
import type { IncidentScope } from "./incidents-query";
import { incidentTypeOptions } from "./incident-options-query";
import { IncidentOptionStatus } from "./IncidentOptionStatus";
interface TypeFilterProps {
  scope: IncidentScope;
  controller: TableController;
}
export function IncidentTypeFilter({ scope, controller }: TypeFilterProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useQuery(incidentTypeOptions(scope, page));
  const value = controller.state.filters["type"] ?? "";
  const options = query.data?.results.map((type) => ({ value: type.id, label: type.label })) ?? [];
  if (value && !options.some((option) => option.value === value))
    options.unshift({ value, label: t("incidents.workspace.selectedType") });
  return (
    <div>
      <Select
        id="incident-type-filter"
        label={t("incidents.workspace.type")}
        value={value}
        options={[{ value: "", label: t("incidents.workspace.allTypes") }, ...options]}
        disabled={query.isFetching}
        onChange={(event) => {
          controller.setFilter("type", event.target.value || undefined);
        }}
      />
      <IncidentOptionStatus page={page} query={query} onPage={setPage} />
    </div>
  );
}
