import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { StatusPill } from "../ui/StatusPill";
import { FleetSourceLink } from "./FleetSourceLink";
type Load = Schemas["FuelLoad"];
function isComparable(load: Load) {
  return (
    !load.provisional &&
    load.is_full_refill &&
    load.baseline !== null &&
    load.efficiency_km_l !== null &&
    ["ok", "review"].includes(load.efficiency_status)
  );
}
/** Comparable is a persisted server fact; no subset, threshold or efficiency is computed here. */
export function FleetEfficiency({ load, code }: { load: Load; code: string }) {
  const { t } = useTranslation();
  if (!isComparable(load)) return <span>{t("fleet.gap.insufficient")}</span>;
  return (
    <>
      <FleetSourceLink code={code} target={{ tab: "fuel", id: load.id }}>
        {t("fleet.efficiency.value", { value: load.efficiency_km_l })}
      </FleetSourceLink>
      <StatusPill tone={load.efficiency_status === "review" ? "warning" : "neutral"}>
        {t(load.efficiency_status === "review" ? "fleet.efficiency.review" : "fleet.efficiency.ok")}
      </StatusPill>
      {load.threshold_min !== null && load.threshold_max !== null && (
        <p>
          {t("fleet.efficiency.thresholds", { min: load.threshold_min, max: load.threshold_max })}
        </p>
      )}
    </>
  );
}
