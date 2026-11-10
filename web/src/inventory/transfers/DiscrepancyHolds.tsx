import { useTranslation } from "react-i18next";
import { useLocationNames } from "../use-location-names";
import { EmptyValue } from "../../ui/EmptyValue";
import type { Discrepancy } from "./discrepancy-query";

export function DiscrepancyHolds({ record }: { record: Discrepancy }) {
  const { t } = useTranslation();
  const nameOf = useLocationNames();
  return (
    <>
      <ul>
        {record.holds.map((hold) => (
          <li key={hold.id}>
            {nameOf(hold.location_id) ?? <EmptyValue />} ·{" "}
            {t(hold.resolution_id ? "discrepancies.holds.released" : "discrepancies.holds.active")}
          </li>
        ))}
      </ul>
    </>
  );
}
