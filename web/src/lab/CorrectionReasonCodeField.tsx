import { useTranslation } from "react-i18next";
import { VoidReasonOptions } from "../void/VoidReasonOptions";
import { useVoidReasons } from "../void/use-void-reasons";
import { ErrorState } from "../ui/ErrorState";
import type { useCorrectionForm } from "./use-correction-form";
import styles from "./lab.module.css";

interface CorrectionReasonCodeFieldProps {
  id: string;
  form: ReturnType<typeof useCorrectionForm>;
  isLocked: boolean;
}

export function CorrectionReasonCodeField({ id, form, isLocked }: CorrectionReasonCodeFieldProps) {
  const { t } = useTranslation();
  const catalog = useVoidReasons();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{t("lab.correction.reasonCode")}</label>
      <select
        id={id}
        value={form.reasonCode}
        disabled={isLocked || catalog.isCatalogBlocked}
        required
        onChange={(event) => {
          form.setCode(event.target.value);
        }}
      >
        <VoidReasonOptions items={catalog.items} isLoading={catalog.isCatalogLoading} />
      </select>
      {catalog.isCatalogBlocked && !catalog.isCatalogLoading && (
        <ErrorState message={t("lab.correction.catalog")} onRetry={catalog.retryCatalog} />
      )}
    </div>
  );
}
