import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import { StatusPill } from "../ui/StatusPill";
import { InlineNotice } from "../ui/InlineNotice";
import type { ShiftDetail } from "./shift-validation";
import { validationState } from "./shift-validation";
import { useLanguage } from "../i18n/use-language";
import styles from "./shifts.module.css";
const STATUS_KEYS = {
  open: "shift.status.open", pending: "shift.status.pending", approved: "shift.status.approved",
  observed: "shift.status.observed", outdated: "shift.status.outdated",
} as const;
export function ShiftSummary({ shift }: { shift: ShiftDetail }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const state = validationState(shift);
  const rows = [
    ["shift.field.reference", shift.id],
    ["shift.field.courier", shift.courier],
    ["shift.field.motorcycle", shift.motorcycle_code],
    ["shift.field.odometerOpen", shift.odometer_open_km.toLocaleString(language)],
    ["shift.field.odometerClose", shift.odometer_close_km?.toLocaleString(language) ?? t("shift.field.unavailable")],
  ] as const;
  return (
    <Card title={t("shift.page.summary")}>
      <StatusPill tone={state === "approved" ? "success" : "warning"}>{t(STATUS_KEYS[state])}</StatusPill>
      <dl className={styles.facts}>{rows.map(([key, value]) => <div key={key}><dt>{t(key)}</dt><dd>{value}</dd></div>)}</dl>
      <InlineNotice>{t("shift.gap.summary")}</InlineNotice>
    </Card>
  );
}
