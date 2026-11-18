/* eslint-disable max-lines-per-function, complexity -- fast mode (demo 2026-11-20): one declarative screen. */
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { DetailSection } from "../../components/templates/DetailSection";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { EmptyValue } from "../../ui/EmptyValue";
import { InlineNotice } from "../../ui/InlineNotice";
import { Switch } from "../../ui/Switch";
import { buildHistory } from "./point-history";
import type { EggsAnswer, HistoryRow } from "./point-history";
import { POINT_PAGE_SIZE } from "./point-query";
import type { PointPageData } from "./use-point-page";
import { VoidedMark } from "./VoidedMark";

const EGGS: Record<EggsAnswer, MessageKey> = {
  yes: "lab.yes",
  no: "lab.no",
  noPaddle: "labTrace.fact.noPaddle",
};

function HistoryLine({ row }: { row: HistoryRow }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const struck = row.voided ? "line-through" : "";
  return (
    <tr className="border-t border-line align-top">
      <td className={`px-3 py-2 whitespace-nowrap ${struck}`}>
        <time dateTime={row.at}>{format(row.at)}</time>
      </td>
      <td className="px-3 py-2">
        <span className={struck}>
          {t(`pointPage.event.${row.kind}` as MessageKey, {
            code: row.ovitrapCode ?? "—",
            next: row.nextCode ?? "—",
          })}
        </span>
        {row.voided && <VoidedMark reason={row.voided.reason} />}
      </td>
      <td className={`px-3 py-2 ${struck}`}>{row.by ?? <EmptyValue />}</td>
      <td className={`px-3 py-2 ${struck}`}>{row.eggs ? t(EGGS[row.eggs]) : <EmptyValue />}</td>
    </tr>
  );
}

/** Placements, checks, replacements, relocations and removals of the point, newest first. */
export function PointHistorySection({
  data,
  showVoided,
  onShowVoided,
}: {
  data: PointPageData;
  showVoided: boolean;
  onShowVoided: (isOn: boolean) => void;
}) {
  const { t } = useTranslation();
  const traps = data.ovitraps.data?.results ?? [];
  const isLoading = data.ovitraps.isLoading || data.readings.isLoading || data.lifecycle.isLoading;
  const all = buildHistory(
    data.lifecycle.data?.entries ?? [],
    data.readings.data?.results ?? [],
    traps,
  );
  const rows = showVoided ? all : all.filter((row) => row.voided === null);
  const isCut = Boolean(data.readings.data?.next);
  return (
    <DetailSection
      title={t("pointPage.history.title")}
      actions={
        <Switch
          label={t("pointPage.history.showVoided")}
          isOn={showVoided}
          onChange={onShowVoided}
        />
      }
    >
      {rows.length === 0 && !isLoading ? (
        <p className="m-0 text-sm text-ink-2">{t("pointPage.history.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="text-left text-xs text-ink-2">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t("pointPage.history.when")}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t("pointPage.history.what")}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t("pointPage.history.who")}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t("pointPage.history.eggs")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <HistoryLine key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isCut && (
        <InlineNotice tone="info">
          {t("pointPage.history.more", { count: POINT_PAGE_SIZE })}
        </InlineNotice>
      )}
    </DetailSection>
  );
}
