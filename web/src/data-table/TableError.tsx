import { useTranslation } from "react-i18next";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import styles from "./data-table.module.css";
import { tableErrorKey } from "./table-error";

interface TableErrorProps {
  error: unknown;
  onRetry: () => void;
  /** Given when the address asks for a page beyond the last one: a way back. */
  onFirstPage: (() => void) | undefined;
}

export function TableError({ error, onRetry, onFirstPage }: TableErrorProps) {
  const { t } = useTranslation();
  const button = classNames(buttons.button, buttons.secondary);
  return (
    <div className={classNames(styles.state, styles.error)} role="alert">
      <p className={styles.stateTitle}>{t(tableErrorKey(error))}</p>
      <div className={styles.stateActions}>
        <button type="button" className={button} onClick={onRetry}>
          {t("common.actions.retry")}
        </button>
        {onFirstPage !== undefined && (
          <button type="button" className={button} onClick={onFirstPage}>
            {t("table.pager.first")}
          </button>
        )}
      </div>
    </div>
  );
}
