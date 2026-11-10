import { useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { StatusPill } from "../../ui/StatusPill";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { fieldKeys, blockerKeys } from "../inventory-fields";
import styles from "../inventory.module.css";
import { ProtocolFacts } from "../ProtocolFacts";
import { lotProtocolOf } from "../inventory-protocol";
import { useInventoryContext } from "../use-inventory-context";
type Lot = Schemas["Lot"];
function Requirements({ lot }: { lot: Lot }) {
  const { t } = useTranslation();
  return (
    <div role="status">
      <p>{t("inventory.state.dispatch")}</p>
      <ul>
        {lot.missing_fields.map((field) => (
          <li key={field}>{t(fieldKeys[field] ?? "inventory.state.required")}</li>
        ))}
        {lot.blocked_by.map((blocker) => (
          <li key={blocker.reason}>
            {t(blockerKeys[blocker.reason] ?? "inventory.blocker.unknown")}
          </li>
        ))}
      </ul>
      {lot.missing_fields.length === 0 && lot.blocked_by.length === 0 && (
        <p>{t("inventory.state.noBlockers")}</p>
      )}
    </div>
  );
}
function DispatchRequirements({ lot }: { lot: Lot }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded(!expanded);
        }}
      >
        {t("inventory.action.requirements")}
      </Button>
      {expanded && <Requirements lot={lot} />}
    </>
  );
}
function CustodyFacts() {
  const { t } = useTranslation();
  const custody = useInventoryContext().readContext.mode === "custody";
  return custody ? (
    <>
      <p>{t("inventory.context.readonly")}</p>
      <p>{t("inventory.context.safety")}</p>
      <p>{t("inventory.context.balance")}</p>
    </>
  ) : null;
}
export function LotSafetySummary({ lot }: { lot: Lot }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const protocol = lotProtocolOf(lot);
  return (
    <Card title={t("inventory.section.safety")}>
      <div className={styles.notes}>
        <CustodyFacts />
        <div className={styles.safetyStatus}>
          <StatusPill tone={lot.status === "available" ? "success" : "warning"}>
            {t(`inventory.status.${lot.status}`)}
          </StatusPill>
        </div>
        <p>
          {t("inventory.field.expiry")}:{" "}
          {lot.expiry ? format(lot.expiry) : t("inventory.state.unconfigured")}
        </p>
        <p>
          {t("inventory.section.protocol")}: {protocol?.name || t("inventory.state.unconfigured")}
        </p>
        {protocol && <ProtocolFacts protocol={protocol} />}
        {lot.admission_id && <p>{t("inventory.state.immutable")}</p>}
        <DispatchRequirements lot={lot} />
      </div>
    </Card>
  );
}
