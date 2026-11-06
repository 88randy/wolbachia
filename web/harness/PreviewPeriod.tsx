import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "../src/forms/Select";
import styles from "./PreviewDashboard.module.css";
interface PreviewPeriodProps {
  weeks?: boolean;
  onChange?: (value: string) => void;
}
export function PreviewPeriod({ weeks = false, onChange }: PreviewPeriodProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState(weeks ? "12w" : "7d");
  const id = useId();
  const options = weeks
    ? [{ value: "12w", label: t("refresh.preview.twelveWeeks") }]
    : [{ value: "7d", label: t("refresh.preview.sevenDays") }];
  return (
    <div className={styles.period}>
      <Select
        id={id}
        hideLabel
        label={t("refresh.preview.period")}
        value={period}
        options={options}
        onChange={(event) => {
          setPeriod(event.target.value);
          onChange?.(event.target.value);
        }}
      />
    </div>
  );
}
