import { useTranslation } from "react-i18next";
import { ConditionCaptureField } from "./ConditionCaptureField";
import type { useConditionCapture } from "./use-condition-capture";
import styles from "./conditions.module.css";
export function ConditionCaptureFields({
  capture,
}: {
  capture: ReturnType<typeof useConditionCapture>;
}) {
  const { t } = useTranslation();
  return (
    <fieldset
      disabled={capture.state.busy || capture.state.uncertain}
      className={styles.captureFields}
    >
      <legend>{t("conditions.section.observation")}</legend>
      {(["device_time", "temperature_c", "humidity_pct"] as const).map((field) => (
        <ConditionCaptureField key={field} field={field} capture={capture} />
      ))}
    </fieldset>
  );
}
