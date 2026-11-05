import { useTranslation } from "react-i18next";
import { useModalDialog } from "../session/use-modal-dialog";
import type { SessionState } from "../session/session-revision";
import { SessionCheckFailed } from "./SessionCheckFailed";
import styles from "./SessionBlocker.module.css";

const INITIAL_FOCUS = "[data-initial-focus]";

/**
 * Blocking layer while the session is not `known` (#82): a modal `<dialog>` opened LAST, so it is
 * the top layer: a content dialog that was open (the void dialog, for instance) is covered and
 * inert, and the retry is always reachable. `reconciling`: `/me/` is being checked. `unknown`: the
 * check failed, with a retry. The screens stay mounted underneath, inert, so drafts are kept.
 * (When the session expired, the re-authentication dialog is the way out and shows instead.)
 */
export function SessionBlocker({ state }: { state: Exclude<SessionState, "known"> }) {
  const { t } = useTranslation();
  const ref = useModalDialog(INITIAL_FOCUS);
  return (
    <dialog ref={ref} className={styles.dialog} aria-label={t("states.sessionCheck.checking")}>
      {state === "unknown" ? (
        <SessionCheckFailed />
      ) : (
        <p className={styles.checking} role="status" tabIndex={-1} data-initial-focus>
          {t("states.sessionCheck.checking")}
        </p>
      )}
    </dialog>
  );
}
