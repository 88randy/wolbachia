import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useCouriers } from "../scheduling/use-directories";
import { useFormatDateTime } from "../format/use-format-date-time";
import { FleetSourceLink } from "./FleetSourceLink";
import { FleetProvenance } from "./FleetProvenance";
import { FleetFactList } from "./FleetFactList";
type FuelProps = { load: Schemas["FuelLoad"]; code: string };
function BaselineReference({ load, code }: FuelProps) {
  const { t } = useTranslation();
  if (!load.baseline) return <>{t("fleet.summary.unknown")}</>;
  return (
    <FleetSourceLink code={code} target={{ tab: "fuel", id: load.baseline }}>
      {t("fleet.fuel.previousLoad")}
    </FleetSourceLink>
  );
}
function ReceiptReference({ load }: FuelProps) {
  const { t } = useTranslation();
  return (
    <>
      {load.receipt_upload_id ? t("fleet.fuel.receiptAttached") : t("fleet.summary.unknown")}
      {load.receipt_pending && <p>{t("fleet.fuel.pending")}</p>}
    </>
  );
}
function FuelReferences(props: FuelProps) {
  const { load } = props;
  const { t } = useTranslation();
  const courierName = useCouriers([]).nameOf;
  return (
    <FleetFactList
      facts={[
        ["fleet.history.courier", courierName(load.courier)],
        ["fleet.fuel.baseline", <BaselineReference key="baseline" {...props} />],
        ["fleet.fuel.receipt", <ReceiptReference key="receipt" {...props} />],
        ["fleet.fuel.full", t(load.is_full_refill ? "fleet.fuel.full" : "fleet.fuel.partial")],
      ]}
    />
  );
}
function FuelClocks({ load }: FuelProps) {
  const format = useFormatDateTime();
  return (
    <FleetFactList
      facts={[
        ["fleet.fuel.deviceTime", format(load.device_time)],
        ["fleet.fuel.serverTime", format(load.server_received_at)],
        [
          "fleet.fuel.rules",
          <span key="rules">
            {load.rules_version}
            <br />
            {load.catalog_version}
          </span>,
        ],
      ]}
    />
  );
}
export function FleetFuelFacts(props: FuelProps) {
  const { t } = useTranslation();
  return (
    <details>
      <summary>{t("fleet.history.provenance")}</summary>
      <FuelReferences {...props} />
      <FuelClocks {...props} />
      {props.load.provisional && <p>{t("fleet.fuel.provisional")}</p>}
      <FleetProvenance value={props.load.rule_provenance} />
    </details>
  );
}
