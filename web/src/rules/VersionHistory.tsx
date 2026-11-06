import { useTranslation } from "react-i18next";
import { FormNotice } from "../forms/FormNotice";
import { Card } from "../ui/Card";
import type { RuleParameter } from "./rules-query";
import { RULE_HISTORY_TITLE_ID } from "./history-ids";
import { VersionHistoryIntro } from "./VersionHistoryIntro";
import { VersionHistoryTable } from "./VersionHistoryTable";
import { useVersionHistoryTarget } from "./use-version-history-target";
import { VoidVersionDialog } from "./VoidVersionDialog";
interface VersionHistoryProps {
  parameter: RuleParameter;
  canVoid: boolean;
}
/** Server-owned versions retain filters, permission checks and immutable void provenance. */
export function VersionHistory({ parameter, canVoid }: VersionHistoryProps) {
  const { t } = useTranslation();
  const state = useVersionHistoryTarget();
  return (
    <Card title={t("rules.history.title")} titleId={RULE_HISTORY_TITLE_ID}>
      <VersionHistoryIntro canVoid={canVoid} />
      {state.isDone && <FormNotice title={t("rules.history.voidDone")} shouldFocus />}
      <VersionHistoryTable parameter={parameter} canVoid={canVoid} onVoid={state.open} />
      {state.target !== undefined && (
        <VoidVersionDialog
          parameterKey={parameter.key}
          version={state.target}
          onCancel={state.cancel}
          onVoided={state.complete}
        />
      )}
    </Card>
  );
}
