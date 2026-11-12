import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import type { Release } from "./releases-query";

/** Label and value pairs of one release; codes, never ids. */
export function ReleaseFacts({ release }: { release: Release }) {
  const { t, i18n } = useTranslation();
  const format = useFormatDateTime();
  const rows: [string, string][] = [
    [t("releases.column.code"), release.code],
    [t("releases.column.permit"), release.permit_code],
    [t("releases.column.lot"), release.lot_code],
    [t("releases.column.device"), release.release_device_code],
    [t("releases.column.quadrant"), release.quadrant_code],
    [
      t("releases.column.quantity"),
      new Intl.NumberFormat(i18n.language).format(Number(release.quantity)),
    ],
    [t("releases.detail.deviceTime"), format(release.device_time)],
    [t("releases.detail.received"), format(release.server_received_at)],
  ];
  return (
    <dl className="m-0 grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs font-semibold text-ink-3">{label}</dt>
          <dd className="m-0 text-sm text-ink [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
