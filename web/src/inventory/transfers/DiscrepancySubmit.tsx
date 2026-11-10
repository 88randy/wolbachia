import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { InlineNotice } from "../../ui/InlineNotice";
import type { DiscrepancyRecordState } from "./discrepancy-use-record";

export function DiscrepancySubmit({ state }: { state: DiscrepancyRecordState }) {
  const { t } = useTranslation();
  const frame = JSON.stringify([state.record?.id, state.record?.revision, state.draft]);
  return (
    <>
      <InlineNotice>
        {t(state.isOnline ? "discrepancies.close.requirements" : "discrepancies.close.offline")}
      </InlineNotice>
      <ConfirmDialog
        key={frame}
        title={t("discrepancies.close.confirmTitle")}
        consequence={t("discrepancies.close.consequence")}
        actionLabel={t("discrepancies.close.confirm")}
        onConfirm={() => {
          if (!state.isBlocked) void state.submit();
        }}
        trigger={
          <Button aria-disabled={state.isBlocked} loading={state.command.isBusy}>
            {t("discrepancies.close.action")}
          </Button>
        }
      />
    </>
  );
}
