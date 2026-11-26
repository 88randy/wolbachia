import { useTranslation } from "react-i18next";
import { VoidReasonOptions } from "../void/VoidReasonOptions";
import { useVoidReasons } from "../void/use-void-reasons";
import { ErrorState } from "../ui/ErrorState";
import type { AnnotationCorrectionFieldProps } from "./AnnotationCorrectionFields";

type Props = Pick<AnnotationCorrectionFieldProps, "code" | "isLocked"> & { id: string };

export function AnnotationCorrectionCodeField(props: Props) {
  const { t } = useTranslation();
  const catalog = useVoidReasons();
  return (
    <>
      <label htmlFor={props.id}>{t("lab.correction.reasonCode")}</label>
      <select
        id={props.id}
        name="reason-code"
        value={props.code[0]}
        required
        disabled={props.isLocked || catalog.isCatalogBlocked}
        onChange={(event) => {
          props.code[1](event.target.value);
        }}
      >
        <VoidReasonOptions items={catalog.items} isLoading={catalog.isCatalogLoading} />
      </select>
      {catalog.isCatalogBlocked && !catalog.isCatalogLoading && (
        <ErrorState message={t("lab.correction.catalog")} onRetry={catalog.retryCatalog} />
      )}
    </>
  );
}
