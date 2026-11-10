import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ValidatedTextField } from "../../forms/ValidatedTextField";
import type { ReviewRecordState } from "./use-review-record";

export function ReviewReasonField({ state }: { state: ReviewRecordState }) {
  const { t } = useTranslation();
  const id = useId();
  const hint = t("reviews.workspace.reasonHint", { min: state.limits.minLength });
  return (
    <>
      <ValidatedTextField
        id={id}
        label={t("reviews.workspace.reason")}
        value={state.reason}
        maxLength={state.limits.maxLength}
        aria-describedby={`${id}-hint`}
        validate={(value) => (value.trim().length < state.limits.minLength ? hint : undefined)}
        onChange={(event) => {
          state.setReason(event.currentTarget.value);
        }}
      />
      <p id={`${id}-hint`}>{hint}</p>
    </>
  );
}
