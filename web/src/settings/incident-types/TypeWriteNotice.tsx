import { useTranslation } from "react-i18next";
import { FormAlert } from "../../forms/FormAlert";
import { Button } from "../../ui/Button";
import type { TypeFormController } from "./use-type-form";
import { useFocusAlert } from "../../forms/use-focus-alert";
export function TypeWriteNotice({ controller }: { controller: TypeFormController }) {
  const { t } = useTranslation();
  const alertRef = useFocusAlert(controller.writer.error ?? undefined);
  const review = () => {
    void controller.reviewCurrent();
  };
  return (
    <>
      {controller.writer.error && (
        <FormAlert id="type-write-error" title={t(controller.writer.error)} ref={alertRef} />
      )}
      {controller.writer.needsReview && (
        <Button variant="secondary" onClick={review}>
          {t("incidentTypes.form.review")}
        </Button>
      )}
    </>
  );
}
