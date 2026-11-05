import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./data-table.module.css";
export function RowExpandButton({
  expanded,
  controls,
  onToggle,
}: {
  expanded: boolean;
  controls: string;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.expandButton}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={t(expanded ? "refresh.table.collapse" : "refresh.table.expand")}
      onClick={onToggle}
    >
      <ChevronRight strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}
