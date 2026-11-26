import { useIsFetching } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useDelayedFlag } from "../ui/use-delayed-flag";
import styles from "./RefreshIndicator.module.css";

/**
 * A background refetch (a filter, a page, a focus) keeps the current content on screen; this thin
 * bar is the only sign of it, and only when it takes long. Whatever is on screen stays; a first
 * load also has its own skeleton.
 */
export function RefreshIndicator() {
  const { t } = useTranslation();
  const refreshing = useIsFetching();
  const isShown = useDelayedFlag(refreshing > 0);
  return (
    <div aria-live="polite" className={styles.region}>
      {isShown && (
        <>
          <span className={styles.bar} aria-hidden="true" />
          <span className={styles.label}>{t("refresh.background.label")}</span>
        </>
      )}
    </div>
  );
}
