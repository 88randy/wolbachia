import { useId } from "react";
import { useTranslation } from "react-i18next";
import styles from "./relocations.module.css";
export function RelocationReason({
  reason,
  onChange,
}: {
  reason: string;
  onChange: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <>
      <label className={styles.field} htmlFor={id}>
        {t("relocations.workspace.decisionReason")}
        <textarea
          id={id}
          value={reason}
          maxLength={1000}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          aria-describedby={`${id}-hint`}
        />
      </label>
      <p id={`${id}-hint`}>{t("relocations.workspace.reasonHint")}</p>
    </>
  );
}
