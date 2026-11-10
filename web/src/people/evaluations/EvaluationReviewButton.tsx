import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import type { ButtonProps } from "../../ui/Button";
import type { EvaluationFormModel } from "./use-evaluation-form";
interface Props extends Omit<ButtonProps, "form"> {
  form: EvaluationFormModel;
}
export function EvaluationReviewButton({ form, ...attributes }: Props) {
  const { t } = useTranslation();
  const isDisabled = form.isBlocked || !form.isOnline || form.command.status !== null;
  function review(event: MouseEvent<HTMLButtonElement>) {
    if (!form.review()) {
      event.preventDefault();
      queueMicrotask(() => {
        document.getElementById("evaluation-errors")?.focus();
      });
      return;
    }
    attributes.onClick?.(event);
  }
  return (
    <Button
      {...attributes}
      type="submit"
      aria-disabled={isDisabled}
      loading={form.command.isBusy}
      onClick={review}
    >
      {t("evaluations.form.review")}
    </Button>
  );
}
