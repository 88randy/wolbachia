import { WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./OfflineBanner.module.css";
import { useOnlineStatus } from "./use-online-status";

/**
 * Navy band above everything while the browser is offline (global-states board). The live
 * region is always in the DOM so screen readers announce the text when it appears.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  return (
    <div role="status">
      {isOnline ? null : (
        <p className={styles.banner}>
          <WifiOff aria-hidden="true" className={styles.icon} />
          {t("states.offline.banner")}
        </p>
      )}
    </div>
  );
}
