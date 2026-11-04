import { useTranslation } from "react-i18next";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import { useFormatCalendarDate } from "../format/use-formatters";
import type { RuleParameterVersion } from "./rules-query";
import styles from "./rules.module.css";

interface VoidVersionButtonProps {
  version: RuleParameterVersion;
  onVoid: (version: RuleParameterVersion) => void;
  /** Id of the note that says why a version that took effect cannot be voided. */
  blockedNoteId: string;
}

/**
 * The "Void" action of a history row. Only a version that has not taken effect can be voided: a
 * version in force or past is history that records may rely on, so its button stays visible but
 * blocked, `aria-disabled` (still reachable by keyboard) and described by the visible note. A
 * voided version has nothing left to do.
 */
export function VoidVersionButton({ version, onVoid, blockedNoteId }: VoidVersionButtonProps) {
  const { t } = useTranslation();
  const formatCalendarDate = useFormatCalendarDate();
  if (version.status === "voided") return null;
  const isScheduled = version.status === "scheduled";
  return (
    <button
      type="button"
      className={classNames(buttons.button, buttons.secondary, !isScheduled && styles.blocked)}
      aria-label={t("rules.history.voidLabel", {
        date: formatCalendarDate(version.effective_date),
      })}
      aria-disabled={!isScheduled}
      aria-describedby={isScheduled ? undefined : blockedNoteId}
      onClick={() => {
        if (isScheduled) onVoid(version);
      }}
    >
      {t("rules.history.void")}
    </button>
  );
}
