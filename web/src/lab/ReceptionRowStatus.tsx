import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { StatusPill } from "../ui/StatusPill";
import type { ReceptionRow } from "./reception-query";
const LABELS: Readonly<Record<string, MessageKey>> = {
  expected: "labReception.status.expected",
  received: "labReception.status.received",
  noPaddle: "labReception.table.noPaddle",
  missing: "labReception.status.missing",
  no_reading: "labReception.status.noEffectiveReading",
};
export function ReceptionRowStatus({ row }: { row: ReceptionRow }) {
  const { t } = useTranslation();
  const isPending = row.discrepancy?.configuration_pending;
  const key = isPending
    ? "labReception.status.configurationPending"
    : (LABELS[row.status] ?? "labReception.table.unknown");
  return <StatusPill tone={row.status === "received" ? "success" : "warning"}>{t(key)}</StatusPill>;
}
