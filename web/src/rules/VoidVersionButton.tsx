import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { useFormatCalendarDate } from "../format/use-formatters";
import type { RuleParameterVersion } from "./rules-query";
import styles from "./rules.module.css";
interface VoidVersionButtonProps {
  version: RuleParameterVersion;
  onVoid: (version: RuleParameterVersion) => void;
  blockedNoteId: string;
}
/** In-force history remains focusable but blocked, with the visible reason attached. */
export function VoidVersionButton({ version, onVoid, blockedNoteId }: VoidVersionButtonProps) {
  const { t } = useTranslation();
  const formatCalendarDate = useFormatCalendarDate();
  if (version.status === "voided") return null;
  const isScheduled = version.status === "scheduled";
  return (
    <Button
      variant="secondary"
      className={isScheduled ? undefined : styles.blocked}
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
    </Button>
  );
}
