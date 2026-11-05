import { useTranslation } from "react-i18next";
import { TableDensity } from "./TableDensity";
import type { TableDensityValue } from "./TableDensity";
import styles from "./data-table.module.css";
interface TableToolbarProps {
  density?: TableDensityValue;
  onDensityChange?: (density: TableDensityValue) => void;
  refreshing: boolean;
}
/** The refreshing indicator overlays the edge so existing rows never move. */
export function TableToolbar({
  density = "comfortable",
  onDensityChange,
  refreshing,
}: TableToolbarProps) {
  const { t } = useTranslation();
  return (
    <>
      {refreshing && (
        <div
          className={styles.refreshProgress}
          role="progressbar"
          aria-label={t("ui.states.refreshing")}
        />
      )}
      {onDensityChange && (
        <div className={styles.toolbar}>
          <TableDensity value={density} onChange={onDensityChange} />
        </div>
      )}
    </>
  );
}
