/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): one declarative card. */
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../i18n/use-language";
import { EmptyValue } from "../../ui/EmptyValue";
import { coordinateRows } from "./trace-model";
import type { BagTrace } from "./trace-query";

const DECIMALS = 6;

/** Coordinates as text: the equivalent of the map for keyboard and screen reader users. */
export function TraceCoordinates({ trace }: { trace: BagTrace }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const number = new Intl.NumberFormat(language, {
    minimumFractionDigits: DECIMALS,
    maximumFractionDigits: DECIMALS,
  });
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="pb-1 text-left text-xs font-semibold text-ink-3">
        {t("labTrace.coords.title")}
      </caption>
      <thead>
        <tr className="text-left text-xs text-ink-3">
          <th scope="col" className="py-1 pr-3 font-semibold">
            {t("labTrace.coords.place")}
          </th>
          <th scope="col" className="py-1 pr-3 text-right font-semibold">
            {t("labTrace.coords.lat")}
          </th>
          <th scope="col" className="py-1 pr-3 text-right font-semibold">
            {t("labTrace.coords.lng")}
          </th>
          <th scope="col" className="py-1 text-right font-semibold">
            {t("labTrace.coords.accuracy")}
          </th>
        </tr>
      </thead>
      <tbody>
        {coordinateRows(trace).map((row) => (
          <tr key={row.id} className="border-t border-line">
            <th scope="row" className="py-1.5 pr-3 text-left font-normal">
              {row.id === "point"
                ? t("labTrace.coords.point", { code: trace.location.point.code })
                : t("labTrace.coords.capture")}
            </th>
            <td className="py-1.5 pr-3 text-right tabular-nums">{number.format(row.lat)}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{number.format(row.lng)}</td>
            <td className="py-1.5 text-right tabular-nums">
              {row.accuracyM === null ? (
                <EmptyValue />
              ) : (
                t("labTrace.fact.meters", { value: Math.round(row.accuracyM) })
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
