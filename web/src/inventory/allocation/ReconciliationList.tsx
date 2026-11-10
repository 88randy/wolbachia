import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { InlineNotice } from "../../ui/InlineNotice";
import { FilterBar } from "../../data-table/FilterBar";
import { JustifyPanel } from "./JustifyPanel";
import { ReconciliationTable } from "./ReconciliationTable";
import { useReconciliationView } from "./use-reconciliation-view";
import type { AllocationScope } from "./allocation-query";
import type { ReconciliationRow } from "./reconciliation-equation";
import styles from "../inventory.module.css";

export function ReconciliationList({ scope }: { scope: AllocationScope }) {
  const { t } = useTranslation();
  const view = useReconciliationView(scope);
  const [selected, setSelected] = useState<ReconciliationRow | null>(null);
  return (
    <div className={styles.content}>
      <Card title={t("allocation.reconciliation.title")} headingLevel={1}>
        <InlineNotice tone="info">{t("allocation.reconciliation.equation")}</InlineNotice>
        <InlineNotice tone="info">{t("allocation.reconciliation.shiftIndependent")}</InlineNotice>
        <div className={styles.filters}>
          <FilterBar controller={view.controller} />
        </div>
        <ReconciliationTable view={view} onJustify={setSelected} />
      </Card>
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
    </div>
  );
}
