import { useTranslation } from "react-i18next";
import { CorrectionFields } from "./CorrectionFields";
import { AnnotationCorrectionLink } from "./AnnotationCorrectionLink";
import type { Count } from "./lab-query";
import type { useCorrectionForm } from "./use-correction-form";
export function CorrectionCountFields({
  form,
  count,
}: {
  form: ReturnType<typeof useCorrectionForm>;
  count: Count;
}) {
  const { t } = useTranslation();
  return (
    <>
      <CorrectionFields form={form} />
      <AnnotationCorrectionLink
        count={count}
        isLocked={form.write.isBusy || form.write.failure?.kind === "uncertain"}
      />
      <div role="alert">{form.hasReasonError && t("lab.correction.noteHint")}</div>
    </>
  );
}
