import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
export function TrainingReviewNotice({ onReview }: { onReview: () => void }) {
  const { t } = useTranslation();
  return (
    <InlineNotice
      tone="warning"
      action={
        <Button variant="secondary" onClick={onReview}>
          {t("trainings.form.review")}
        </Button>
      }
    >
      {t("trainings.form.reviewHint")}
    </InlineNotice>
  );
}
