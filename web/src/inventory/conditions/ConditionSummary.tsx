import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { StatusPill } from "../../ui/StatusPill";
import { InlineNotice } from "../../ui/InlineNotice";
import { ProtocolFacts } from "../ProtocolFacts";
import { ConditionSlots } from "./ConditionSlots";
import { ConditionBlockers } from "./ConditionBlockers";
import styles from "../inventory.module.css";
import conditionStyles from "./conditions.module.css";

export function ConditionSummary({ status }: { status: Schemas["ConditionStatus"] }) {
  const { t } = useTranslation();
  return (
    <Card title={t("conditions.section.today")}>
      <div className={[styles.notes, conditionStyles.summary].join(" ")}>
        <p>
          {status.local_date} · {status.timezone}
        </p>
        <StatusPill tone={status.status === "available" ? "success" : "warning"}>
          {t(`inventory.status.${status.status}`)}
        </StatusPill>
        {!status.is_protocol_configured && (
          <InlineNotice tone="warning">{t("conditions.state.unconfigured")}</InlineNotice>
        )}
        <ConditionSlots slots={status.slots} />
        <ConditionBlockers status={status} />
        <details>
          <summary>{t("conditions.section.protocol")}</summary>
          <ProtocolFacts protocol={status.protocol} />
        </details>
      </div>
    </Card>
  );
}
