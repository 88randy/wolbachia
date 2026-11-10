import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import type { ShiftDecisionFormState } from "./use-shift-decision";

export function ShiftDecisionFeedback({ form }: { form: ShiftDecisionFormState }) {
  const { t } = useTranslation();
  return (
    <>
      <div role="alert">
        {form.failure && <InlineNotice tone="critical">{t(form.failure)}</InlineNotice>}
      </div>
      {form.isBlocked && !form.failure && (
        <InlineNotice tone="warning">{t("shift.blocker.refresh")}</InlineNotice>
      )}
    </>
  );
}
