import { useTranslation } from "react-i18next";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import styles from "./filter-bar.module.css";

interface IgnoredNoticeProps {
  /** Names of the URL parameters that were unknown or invalid. */
  names: readonly string[];
  onDismiss: () => void;
}

/**
 * The address carried parameters this list does not know (an old bookmark, a typo, a link edited
 * by hand). They are never applied; the notice says so and offers to clean the address. It is a
 * status, not an alert: nothing failed.
 */
export function IgnoredNotice({ names, onDismiss }: IgnoredNoticeProps) {
  const { t } = useTranslation();
  if (names.length === 0) return null;
  return (
    <div className={styles.notice} role="status">
      <p className={styles.noticeTitle}>{t("table.filters.ignoredTitle")}</p>
      <p className={styles.noticeBody}>
        {t("table.filters.ignoredBody", { names: names.join(", ") })}
      </p>
      <button
        type="button"
        className={classNames(buttons.button, buttons.secondary)}
        onClick={onDismiss}
      >
        {t("table.filters.ignoredDismiss")}
      </button>
    </div>
  );
}
