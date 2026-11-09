import { useId } from "react";
import { useTranslation } from "react-i18next";
import { VoidReasonOptions } from "../void/VoidReasonOptions";
import { useVoidReasons } from "../void/use-void-reasons";
import { ErrorState } from "../ui/ErrorState";
import { CountInput } from "./CountInput";
import type { useCorrectionForm } from "./use-correction-form";
import styles from "./lab.module.css";
export function CorrectionFields({ form }: { form: ReturnType<typeof useCorrectionForm> }) {
  const { t } = useTranslation();
  const id = useId();
  const catalog = useVoidReasons();
  const isLocked = form.write.isBusy || form.write.failure?.kind === "uncertain";
  return (
    <>
      <div className={styles.field}><label htmlFor={id}>{t("lab.correction.reasonCode")}</label>
        <select id={id} value={form.reasonCode} disabled={isLocked || catalog.isCatalogBlocked} required onChange={(event) => { form.setCode(event.target.value); }}>
          <VoidReasonOptions items={catalog.items} isLoading={catalog.isCatalogLoading} />
        </select>
        {catalog.isCatalogBlocked && !catalog.isCatalogLoading && <ErrorState message={t("lab.correction.catalog")} onRetry={catalog.retryCatalog} />}
      </div>
      <div className={styles.field}><label htmlFor={id + "-note"}>{t("lab.correction.reason")}</label>
        <textarea id={id + "-note"} value={form.reason} readOnly={isLocked} maxLength={1000} aria-invalid={form.hasReasonError || undefined} aria-describedby={id + "-help"} onChange={(event) => { form.setReason(event.target.value); }} />
        <p id={id + "-help"}>{t("lab.correction.noteHint")}</p>
      </div>
      <CountInput onBlur={form.validateCount} value={form.value} onChange={form.setValue} inputRef={form.input} isInvalid={form.isInvalid} isReadOnly={isLocked} isReplacement />
    </>
  );
}
