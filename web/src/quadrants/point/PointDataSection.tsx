/* eslint-disable max-lines-per-function, complexity -- fast mode (demo 2026-11-20): one declarative screen. */
import { useTranslation } from "react-i18next";
import { DescriptionGrid } from "../../components/templates/DescriptionGrid";
import { DetailSection } from "../../components/templates/DetailSection";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { useLanguage } from "../../i18n/use-language";
import { EntityName } from "../../lookups/EntityName";
import { currentOvitrap } from "./point-history";
import type { PointPageData } from "./use-point-page";

const DECIMALS = 6;

/** Point code, block, quadrant, center, exact coordinates and the ovitrap that is there now. */
export function PointDataSection({ data }: { data: PointPageData }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const format = useFormatDateTime();
  const point = data.point.data;
  const quadrant = data.quadrant.data;
  if (!point || !quadrant) return null;
  const number = new Intl.NumberFormat(language, {
    minimumFractionDigits: DECIMALS,
    maximumFractionDigits: DECIMALS,
  });
  const [lng, lat] = point.current_version?.location ?? [];
  const trap = currentOvitrap(data.ovitraps.data?.results ?? []);
  const installed = trap
    ? t("pointPage.ovitrap.installed", { code: trap.code, date: format(trap.device_time) })
    : null;
  return (
    <DetailSection title={t("pointPage.data.title")}>
      <DescriptionGrid
        items={[
          { label: t("pointPage.field.point"), value: point.code },
          { label: t("pointPage.field.block"), value: point.block_code },
          { label: t("pointPage.field.quadrant"), value: quadrant.code },
          {
            label: t("pointPage.field.center"),
            value: <EntityName kind="center" id={quadrant.center} />,
          },
          {
            label: t("pointPage.field.latitude"),
            value: lat === undefined ? null : number.format(lat),
          },
          {
            label: t("pointPage.field.longitude"),
            value: lng === undefined ? null : number.format(lng),
          },
          {
            label: t("pointPage.field.since"),
            value: point.current_version ? format(point.current_version.effective_from) : null,
          },
          ...(data.canSeeTraps
            ? [
                {
                  label: t("pointPage.field.ovitrap"),
                  value: data.ovitraps.isLoading
                    ? null
                    : (installed ?? t("pointPage.ovitrap.none")),
                  wide: true,
                },
              ]
            : []),
        ]}
      />
    </DetailSection>
  );
}
