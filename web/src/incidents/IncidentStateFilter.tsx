import { useTranslation } from "react-i18next";
import { Select } from "../forms/Select";
import type { TableController } from "../data-table/table-types";
const STATES = ["open", "closed", "voided", "all"] as const;
export function IncidentStateFilter({ controller }: { controller: TableController }) {
  const { t } = useTranslation();
  return (
    <Select
      id="incident-state-filter"
      label={t("incidents.workspace.state")}
      value={controller.state.filters["state"] ?? "open"}
      options={STATES.map((value) => ({ value, label: t(`incidents.state.${value}`) }))}
      onChange={(event) => { controller.setFilter("state", event.target.value); }}
    />
  );
}
