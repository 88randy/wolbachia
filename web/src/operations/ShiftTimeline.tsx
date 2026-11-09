import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import { InlineNotice } from "../ui/InlineNotice";
import { useFormatDateTime } from "../format/use-format-date-time";
import type { ShiftDetail } from "./shift-validation";
import styles from "./shifts.module.css";
/** Only actual lifecycle instants are available. A missing GPS feed is never a zero-length track. */
export function ShiftTimeline({ shift }: { shift: ShiftDetail }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <Card title={t("shift.page.timeline")}>
      <InlineNotice tone="warning">{t("shift.gap.track")}</InlineNotice>
      <ol className={styles.timeline} aria-label={t("shift.page.timeline")}>
        <li><strong>{t("shift.field.opened")}</strong><time dateTime={shift.opened_at_device}>{format(shift.opened_at_device)}</time><p>{shift.open_note}</p></li>
        <li><strong>{t("shift.field.closed")}</strong>{shift.closed_at_device
          ? <time dateTime={shift.closed_at_device}>{format(shift.closed_at_device)}</time>
          : <p>{t("shift.status.open")}</p>}<p>{shift.close_note}</p></li>
      </ol>
    </Card>
  );
}
