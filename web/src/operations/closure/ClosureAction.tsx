import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import { useClosureAction } from "./use-closure-action";
import type { ClosureActionProps } from "./use-closure-action";
export function ClosureAction(props: ClosureActionProps) {
  const { t } = useTranslation();
  const action = useClosureAction(props);
  const trigger = (
    <Button aria-disabled={!action.canClose} loading={props.write.isBusy} onClick={action.freeze}>
      {t("closure.actions.close")}
    </Button>
  );
  return (
    <>
      {!action.isOnline && <InlineNotice tone="warning">{t("closure.write.offline")}</InlineNotice>}
      {action.hasChanged && (
        <div role="alert">
          <InlineNotice tone="warning">{t("closure.write.changed")}</InlineNotice>
        </div>
      )}
      <ConfirmDialog
        title={t("closure.confirm.title")}
        consequence={t("closure.confirm.consequence")}
        actionLabel={t("closure.actions.confirm")}
        onConfirm={action.confirm}
        trigger={trigger}
      />
    </>
  );
}
