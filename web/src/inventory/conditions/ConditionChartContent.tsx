import type { Schemas } from "@wolbachia/api-client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { ConditionTrend } from "./ConditionTrend";
import { chartReadings } from "./condition-chart";
import type { ConditionMetric } from "./condition-chart";
import styles from "../inventory.module.css";
export function ConditionChartContent({ readings }: { readings: readonly Schemas["Condition"][] }) {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<ConditionMetric>("temperature");
  const rows = chartReadings(readings, metric);
  return (
    <>
      <div className={styles.actions}>
        {(["temperature", "humidity"] as const).map((choice) => (
          <Button
            key={choice}
            variant="secondary"
            aria-pressed={metric === choice}
            onClick={() => {
              setMetric(choice);
            }}
          >
            {t(`conditions.field.${choice}`)}
          </Button>
        ))}
      </div>
      <p>{t("conditions.state.chartScope")}</p>
      {rows.length !== readings.length && <p>{t("conditions.state.missingRange")}</p>}
      <ConditionTrend rows={rows} metric={metric} />
    </>
  );
}
