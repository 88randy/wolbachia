import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { Card } from "../ui/Card";
import type { FleetTab } from "./use-fleet-tabs";
import styles from "./fleet.module.css";
const GAPS: Record<Exclude<FleetTab, "summary">, MessageKey> = {
  services: "fleet.gap.services",
  responsibility: "fleet.gap.responsibility",
  fuel: "fleet.gap.fuel",
  incidents: "fleet.gap.incidents",
};
export function FleetGap({ tab }: { tab: Exclude<FleetTab, "summary"> }) {
  const { t } = useTranslation();
  return (
    <Card title={t("fleet.gap.title")}>
      <p className={styles.hint}>{t(GAPS[tab])}</p>
      {tab === "fuel" && <p>{t("fleet.gap.insufficient")}</p>}
    </Card>
  );
}
