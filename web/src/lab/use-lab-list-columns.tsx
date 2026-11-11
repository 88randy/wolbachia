import { useCenterColumns } from "../data-table/center-column";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../data-table/table-types";
import { useFormatDateTime } from "../format/use-format-date-time";
import { useLanguage } from "../i18n/use-language";
import { StatusPill } from "../ui/StatusPill";
import type { Tone } from "../ui/tone";
import { LabName } from "./LabName";
import type { MaterialRow, PaddleRow, RecountRow, SampleRow, ShipmentRow } from "./lab-lists";

export const RECOUNT_TONE: Record<RecountRow["state"], Tone> = {
  awaiting_second: "warning",
  awaiting_third: "warning",
  awaiting_selection: "warning",
  resolved: "success",
  superseded: "neutral",
  awaiting_configuration: "critical",
  awaiting_material: "critical",
};
export const RESULT_TONE: Record<SampleRow["result_status"], Tone> = {
  missing: "neutral",
  invalid: "warning",
  disputed: "critical",
  positive: "success",
  negative: "info",
};

function date(format: (iso: string) => string, iso: string) {
  return <time dateTime={iso}>{format(iso)}</time>;
}

export function RecountState({ state }: { state: RecountRow["state"] }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={RECOUNT_TONE[state]}>
      {t(`lab.recounts.state.${state}` as MessageKey)}
    </StatusPill>
  );
}

export function ResultState({ status }: { status: SampleRow["result_status"] }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={RESULT_TONE[status]}>
      {t(`lab.results.status.${status}` as MessageKey)}
    </StatusPill>
  );
}

export function useRecountColumns(): DataTableColumn<RecountRow>[] {
  return [
    { id: "bag_code", headerKey: "lab.col.bag", cell: (row) => row.bag_code },
    { id: "state", headerKey: "lab.col.state", cell: (row) => <RecountState state={row.state} /> },
  ];
}

export function usePaddleColumns(): DataTableColumn<PaddleRow>[] {
  const format = useFormatDateTime();
  return [
    { id: "code", headerKey: "lab.col.code", cell: (row) => row.code },
    {
      id: "location",
      headerKey: "lab.col.location",
      cell: (row) => <LabName kind="location" id={row.location_id} />,
    },
    {
      id: "created_at",
      headerKey: "lab.paddles.created",
      cell: (row) => date(format, row.created_at),
    },
  ];
}

function useShipmentStatusColumns(): DataTableColumn<ShipmentRow>[] {
  const { t } = useTranslation();
  return [
    {
      id: "rfc",
      headerKey: "lab.col.rfc",
      cell: (row) => (row.rfc === "" ? t("lab.shipments.rfcOmitted") : row.rfc),
    },
    {
      id: "state",
      headerKey: "lab.col.state",
      cell: (row) =>
        row.is_superseded ? (
          <StatusPill tone="neutral">{t("lab.shipments.superseded")}</StatusPill>
        ) : (
          <StatusPill tone="success">{t("lab.shipments.current")}</StatusPill>
        ),
    },
  ];
}

export function useShipmentColumns(): DataTableColumn<ShipmentRow>[] {
  const format = useFormatDateTime();
  const { language } = useLanguage();
  return [
    { id: "code", headerKey: "lab.col.code", cell: (row) => row.code },
    { id: "recipient", headerKey: "lab.col.recipient", cell: (row) => row.recipient_institution },
    { id: "cutoff", headerKey: "lab.col.cutoff", cell: (row) => date(format, row.cutoff) },
    {
      id: "samples",
      headerKey: "lab.shipments.samples",
      align: "end",
      cell: (row) => new Intl.NumberFormat(language).format(row.source_snapshot.length),
    },
    ...useShipmentStatusColumns(),
  ];
}

function useSampleTailColumns(): DataTableColumn<SampleRow>[] {
  const format = useFormatDateTime();
  return [
    {
      id: "attempts",
      headerKey: "lab.col.attempts",
      align: "end",
      cell: (row) => row.attempts.length,
    },
    { id: "created_at", headerKey: "lab.col.date", cell: (row) => date(format, row.created_at) },
  ];
}

export function useSampleColumns(): DataTableColumn<SampleRow>[] {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const base: DataTableColumn<SampleRow>[] = [
    { id: "code", headerKey: "lab.col.code", cell: (row) => row.code },
    {
      id: "quadrant",
      headerKey: "lab.col.quadrant",
      cell: (row) => <LabName kind="quadrant" id={row.quadrant_id} />,
    },
    {
      id: "received",
      headerKey: "lab.col.received",
      cell: (row) =>
        row.receipt ? (
          date(format, row.receipt.created_at)
        ) : (
          <StatusPill tone="warning">{t("lab.no")}</StatusPill>
        ),
    },
    {
      id: "result",
      headerKey: "lab.col.result",
      cell: (row) => <ResultState status={row.result_status} />,
    },
    ...useSampleTailColumns(),
  ];
  return useCenterColumns(base, (row) => row.center_id, { after: "code" });
}

export function MaterialNotice({ row }: { row: MaterialRow }) {
  const { t } = useTranslation();
  return row.notifications.length > 0 ? (
    <StatusPill tone="success">{t("lab.materials.noticeDone")}</StatusPill>
  ) : (
    <StatusPill tone="warning">{t("lab.materials.noticePending")}</StatusPill>
  );
}

export function MaterialDelivery({ row }: { row: MaterialRow }) {
  const { t } = useTranslation();
  if (row.is_voided) return <StatusPill tone="neutral">{t("lab.materials.voided")}</StatusPill>;
  if (row.delivery_id)
    return <StatusPill tone="success">{t("lab.materials.delivered")}</StatusPill>;
  if (row.notifications.length === 0)
    return <StatusPill tone="critical">{t("lab.materials.blocked")}</StatusPill>;
  return <StatusPill tone="info">{t("lab.materials.notDelivered")}</StatusPill>;
}

export function useMaterialColumns(): DataTableColumn<MaterialRow>[] {
  const { language } = useLanguage();
  return [
    { id: "code", headerKey: "lab.col.code", cell: (row) => row.code },
    { id: "recipient", headerKey: "lab.col.recipient", cell: (row) => row.recipient_institution },
    {
      id: "location",
      headerKey: "lab.col.location",
      cell: (row) => <LabName kind="location" id={row.location_id} />,
    },
    {
      id: "quantity",
      headerKey: "lab.col.quantity",
      align: "end",
      cell: (row) => new Intl.NumberFormat(language).format(Number(row.quantity)),
    },
    { id: "notice", headerKey: "lab.col.notice", cell: (row) => <MaterialNotice row={row} /> },
    {
      id: "delivery",
      headerKey: "lab.col.delivery",
      cell: (row) => <MaterialDelivery row={row} />,
    },
  ];
}
