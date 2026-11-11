import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../format/use-format-date-time";
import { useShowCenter } from "../lookups/use-center-scope";
import { EmptyValue } from "../ui/EmptyValue";
import { LabFacts } from "./LabFacts";
import type { LabFact } from "./LabFacts";
import { LabName } from "./LabName";
import type { LabDetail } from "./LabDetailSheet";
import type { MaterialRow, PaddleRow, RecountRow, SampleRow, ShipmentRow } from "./lab-lists";
import {
  MaterialDelivery,
  MaterialNotice,
  RecountState,
  ResultState,
} from "./use-lab-list-columns";

export function useRecountDetail(): (row: RecountRow) => LabDetail {
  const { t } = useTranslation();
  return (row) => ({
    title: t("lab.detail.recount", { code: row.bag_code }),
    status: <RecountState state={row.state} />,
    content: <LabFacts items={[{ label: t("lab.col.bag"), value: row.bag_code }]} />,
  });
}

export function usePaddleDetail(): (row: PaddleRow) => LabDetail {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (row) => ({
    title: t("lab.detail.paddle", { code: row.code }),
    content: (
      <LabFacts
        items={[
          { label: t("lab.col.location"), value: <LabName kind="location" id={row.location_id} /> },
          { label: t("lab.paddles.created"), value: format(row.created_at) },
        ]}
      />
    ),
  });
}

export function useShipmentDetail(): (row: ShipmentRow) => LabDetail {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (row) => ({
    title: t("lab.detail.shipment", { code: row.code }),
    description: row.is_superseded ? t("lab.shipments.superseded") : t("lab.shipments.current"),
    content: (
      <LabFacts
        items={[
          { label: t("lab.col.recipient"), value: row.recipient_institution },
          { label: t("lab.col.cutoff"), value: format(row.cutoff) },
          { label: t("lab.shipments.samples"), value: row.source_snapshot.length },
          {
            label: t("lab.col.rfc"),
            value: row.rfc === "" ? t("lab.shipments.rfcOmitted") : row.rfc,
          },
        ]}
      />
    ),
  });
}

function attemptStatus(attempt: SampleRow["attempts"][number]): SampleRow["result_status"] {
  if (attempt.result) return attempt.result;
  return attempt.status === "valid" ? "missing" : attempt.status;
}

function AttemptList({ sample }: { sample: SampleRow }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  if (sample.attempts.length === 0) return <EmptyValue />;
  return (
    <section aria-label={t("lab.detail.attemptsTitle")} className="flex flex-col gap-2">
      <h3 className="m-0 text-sm font-semibold">{t("lab.detail.attemptsTitle")}</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {sample.attempts.map((attempt) => (
          <li key={attempt.id} className="flex items-center justify-between gap-3 text-sm">
            <ResultState status={attemptStatus(attempt)} />
            <time dateTime={attempt.created_at}>{format(attempt.created_at)}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Translate = (key: MessageKey) => string;
type Format = (iso: string) => string;

// eslint-disable-next-line max-params -- fast mode (demo 2026-11-20)
function sampleFacts(t: Translate, format: Format, row: SampleRow, showCenter: boolean): LabFact[] {
  return [
    ...(showCenter
      ? [{ label: t("lab.col.center"), value: <LabName kind="center" id={row.center_id} /> }]
      : []),
    { label: t("lab.col.quadrant"), value: <LabName kind="quadrant" id={row.quadrant_id} /> },
    { label: t("lab.detail.collector"), value: <LabName kind="user" id={row.collector_id} /> },
    { label: t("lab.detail.collectedAt"), value: format(row.device_time) },
    {
      label: t("lab.col.received"),
      value: row.receipt ? format(row.receipt.created_at) : t("lab.no"),
    },
    { label: t("lab.detail.method"), value: row.method.name },
  ];
}

export function useSampleDetail(): (row: SampleRow) => LabDetail {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const showCenter = useShowCenter();
  return (row) => ({
    title: t("lab.detail.sample", { code: row.code }),
    status: <ResultState status={row.result_status} />,
    content: (
      <>
        <LabFacts items={sampleFacts(t, format, row, showCenter)} />
        <AttemptList sample={row} />
      </>
    ),
  });
}

function materialFacts(t: Translate, row: MaterialRow): LabFact[] {
  return [
    { label: t("lab.col.recipient"), value: row.recipient_institution },
    { label: t("lab.col.quantity"), value: Number(row.quantity) },
    { label: t("lab.col.location"), value: <LabName kind="location" id={row.location_id} /> },
    { label: t("lab.col.lot"), value: <LabName kind="lot" id={row.lot_id} /> },
    { label: t("lab.col.notice"), value: <MaterialNotice row={row} /> },
  ];
}

export function useMaterialDetail(): (row: MaterialRow) => LabDetail {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (row) => ({
    title: t("lab.detail.material", { code: row.code }),
    status: <MaterialDelivery row={row} />,
    content: (
      <>
        <LabFacts items={materialFacts(t, row)} />
        {row.notifications.map((notice) => (
          <LabFacts
            key={notice.id}
            items={[
              { label: t("lab.detail.noticeRef"), value: notice.reference },
              { label: t("lab.detail.noticeDate"), value: format(notice.date) },
            ]}
          />
        ))}
      </>
    ),
  });
}
