import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import { blockerKey } from "./shift-validation";
import type { ShiftDetail } from "./shift-validation";

export function ShiftBlockerNotices({ shift, isReady }: { shift: ShiftDetail; isReady: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      {!isReady && <InlineNotice tone="warning">{t("shift.blocker.refresh")}</InlineNotice>}
      {shift.status === "open" && (
        <InlineNotice tone="warning">{t("shift.blocker.open")}</InlineNotice>
      )}
      {shift.validation.blockers.map((code) => (
        <InlineNotice key={code} tone="warning">
          {t(blockerKey(code))}
        </InlineNotice>
      ))}
    </>
  );
}
