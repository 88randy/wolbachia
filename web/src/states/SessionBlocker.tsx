import { useTranslation } from "react-i18next";
import styles from "../shell/AppShell.module.css";
import type { SessionState } from "../session/session-revision";
import pageStyles from "../styles/page.module.css";
import { SessionCheckFailed } from "./SessionCheckFailed";

/**
 * Blocking layer over the page while the session is not `known` (#82). `reconciling`: `/me/` is
 * being checked. `unknown`: the check failed, with a retry. The screens stay mounted underneath,
 * inert, so drafts are kept.
 */
export function SessionBlocker({ state }: { state: Exclude<SessionState, "known"> }) {
  const { t } = useTranslation();
  return (
    <div className={styles.blocker}>
      {state === "unknown" ? (
        <SessionCheckFailed />
      ) : (
        <p className={pageStyles.body} role="status">
          {t("states.sessionCheck.checking")}
        </p>
      )}
    </div>
  );
}
