/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): one declarative screen. */
import { useTranslation } from "react-i18next";
import { DetailSection } from "../../components/templates/DetailSection";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { BagCodeLink } from "../../lab/trace/BagCodeLink";
import { EmptyValue } from "../../ui/EmptyValue";
import { pointBags } from "./point-history";
import type { PointBag } from "./point-history";
import type { PointPageData } from "./use-point-page";
import { VoidedMark } from "./VoidedMark";

function BagLine({ bag }: { bag: PointBag }) {
  const format = useFormatDateTime();
  const struck = bag.voided ? "line-through" : "";
  return (
    <tr className="border-t border-line align-top">
      <td className={`px-3 py-2 ${struck}`}>
        <BagCodeLink code={bag.code} />
        {bag.voided && <VoidedMark reason={bag.voided.reason} />}
      </td>
      <td className={`px-3 py-2 whitespace-nowrap ${struck}`}>
        <time dateTime={bag.at}>{format(bag.at)}</time>
      </td>
      <td className={`px-3 py-2 ${struck}`}>{bag.by ?? <EmptyValue />}</td>
      <td className={`px-3 py-2 tabular-nums ${struck}`}>{bag.week}</td>
    </tr>
  );
}

/** The bags that came from this point; each code opens the full origin of the paddle. */
export function PointBagsSection({
  data,
  showVoided,
}: {
  data: PointPageData;
  showVoided: boolean;
}) {
  const { t } = useTranslation();
  const bags = pointBags(data.readings.data?.results ?? []).filter(
    (bag) => showVoided || bag.voided === null,
  );
  return (
    <DetailSection title={t("pointPage.bags.title")}>
      {bags.length === 0 && !data.readings.isLoading ? (
        <p className="m-0 text-sm text-ink-2">{t("pointPage.bags.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="text-left text-xs text-ink-2">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t("pointPage.bags.bag")}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t("pointPage.bags.collected")}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t("pointPage.bags.by")}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t("pointPage.bags.week")}
                </th>
              </tr>
            </thead>
            <tbody>
              {bags.map((bag) => (
                <BagLine key={bag.code} bag={bag} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DetailSection>
  );
}
