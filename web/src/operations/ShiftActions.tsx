import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import type { ShiftDetail } from "./shift-validation";
import { blockerKey } from "./shift-validation";
import { ShiftDecisionDialog } from "./ShiftDecisionDialog";
import page from "../styles/page.module.css";
export function ShiftActions({ shift, isReady, readSequence }: { shift: ShiftDetail; isReady: boolean; readSequence: number }) {
  const { t } = useTranslation();
  return (
    <div>
      {!isReady && <InlineNotice tone="warning">{t("shift.blocker.refresh")}</InlineNotice>}
      {shift.status === "open" && <InlineNotice tone="warning">{t("shift.blocker.open")}</InlineNotice>}
      {shift.validation.blockers.map((code) => <InlineNotice key={code} tone="warning">{t(blockerKey(code))}</InlineNotice>)}
      <div className={page.actions}>
        <ShiftDecisionDialog shift={shift} kind="observe" isReady={isReady} readSequence={readSequence} />
        <ShiftDecisionDialog shift={shift} kind="approve" isReady={isReady} readSequence={readSequence} />
      </div>
    </div>
  );
}
