import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { StatusPill } from "../ui/StatusPill";
import { InlineNotice } from "../ui/InlineNotice";
import { useFormatDateTime } from "../format/use-format-date-time";
import { ShiftDecisionMetadata } from "./ShiftDecisionMetadata";
import styles from "./shifts.module.css";
export function ShiftHistory({ decisions }: { decisions: readonly Schemas["ShiftDecision"][] }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <Card title={t("shift.page.history")}>
      <div aria-live="polite">
        {decisions.length === 0 ? (
          <EmptyState kind="noData" message={t("shift.history.empty")} />
        ) : (
          <ol className={styles.timeline}>
            {decisions.map((decision) => (
              <li key={decision.id}>
                <StatusPill tone={decision.kind === "approve" ? "success" : "warning"}>
                  {t(
                    decision.kind === "approve" ? "shift.status.approved" : "shift.status.observed",
                  )}
                </StatusPill>
                <time dateTime={decision.created_at}>{format(decision.created_at)}</time>
                <p className={styles.reason}>{decision.reason}</p>
                <ShiftDecisionMetadata decision={decision} />
              </li>
            ))}
          </ol>
        )}
      </div>
      <InlineNotice>{t("shift.gap.points")}</InlineNotice>
    </Card>
  );
}
