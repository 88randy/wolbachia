import { useId } from "react";
import { useTranslation } from "react-i18next";
import styles from "./geography.module.css";
interface Props {
  value: string;
  onChange: (text: string) => void;
  isInvalid?: boolean;
  isDisabled?: boolean;
}
export function PolygonField({ value, onChange, isInvalid, isDisabled }: Props) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{t("geography.field.polygon")}</label>
      <textarea
        id={id}
        rows={8}
        value={value}
        disabled={isDisabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        aria-invalid={isInvalid || undefined}
        aria-describedby={id + "-hint"}
      />
      <p id={id + "-hint"}>{t(isInvalid ? "geography.error.geometry" : "geography.editor.hint")}</p>
    </div>
  );
}
