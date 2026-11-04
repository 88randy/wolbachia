import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import styles from "./data-table.module.css";

interface SelectionBarProps {
  count: number;
  /** Screen actions for the selected rows. */
  actions: ReactNode;
  onClear: () => void;
}

/** Shown while rows are selected: how many, the screen's actions and a way to clear them. */
export function SelectionBar({ count, actions, onClear }: SelectionBarProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.selectionBar}>
      <p className={styles.selectionCount} role="status">
        {t("table.selection.count", { count })}
      </p>
      {actions}
      <button
        type="button"
        className={classNames(buttons.button, buttons.secondary)}
        onClick={onClear}
      >
        {t("table.selection.clear")}
      </button>
    </div>
  );
}
