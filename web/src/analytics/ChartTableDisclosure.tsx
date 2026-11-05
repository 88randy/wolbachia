import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChartDataTable } from "./ChartDataTable";
import type { ChartProps } from "./chart-types";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
/** The disclosure owns visibility only; the source arrays always remain unchanged. */
export function ChartTableDisclosure(props: ChartProps) {
  const { t } = useTranslation();
  const [isVisible, setVisible] = useState(false);
  const tableId = useId();
  return (
    <>
      <button
        type="button"
        className={classNames(buttons.button, buttons.ghost, buttons.sm)}
        aria-expanded={isVisible}
        aria-controls={tableId}
        onClick={() => {
          setVisible(!isVisible);
        }}
      >
        {t(isVisible ? "analytics.chart.hideTable" : "analytics.chart.showTable")}
      </button>
      <div id={tableId}>{isVisible && <ChartDataTable {...props} />}</div>
    </>
  );
}
