import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import { FilterBar } from "../../data-table/FilterBar";
import { JustifyPanel } from "./JustifyPanel";
import { ReconciliationTable } from "./ReconciliationTable";
import { useReconciliationView } from "./use-reconciliation-view";
import type { AllocationScope } from "./allocation-query";
import type { ReconciliationRow } from "./reconciliation-equation";

export function ReconciliationList({ scope }: { scope: AllocationScope }) {
  const { t } = useTranslation();
  const view = useReconciliationView(scope);
  const [selected, setSelected] = useState<ReconciliationRow | null>(null);
  return (
    <ListPage
      title={t("allocation.reconciliation.title")}
      description={t("allocation.reconciliation.equation")}
    >
      <FilterBar controller={view.controller} />
      <ReconciliationTable view={view} onJustify={setSelected} />
      {selected && (
        <JustifyPanel
          key={selected.key}
          scope={scope}
          row={selected}
          onClose={() => {
            setSelected(null);
          }}
        />
      )}
    </ListPage>
  );
}
