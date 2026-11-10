import { useTranslation } from "react-i18next";
import { DescriptionGrid } from "../components/templates/DescriptionGrid";
import { DetailSection } from "../components/templates/DetailSection";
import { useFormatDateTime } from "../format/use-format-date-time";
import { EntityName } from "../lookups/EntityName";
import type { MotorcycleDetail } from "./fleet-query";
import { MotorcycleMetricsSummary } from "./MotorcycleMetricsSummary";
export function MotorcycleSummary({ motorcycle }: { motorcycle: MotorcycleDetail }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const voided = motorcycle.voided_at
    ? [
        { label: t("fleet.summary.voidedAt"), value: format(motorcycle.voided_at) },
        {
          label: t("fleet.summary.voidedBy"),
          value: <EntityName kind="user" id={motorcycle.voided_by} />,
        },
        { label: t("common.fields.voidReason"), value: motorcycle.void_reason, wide: true },
      ]
    : [];
  return (
    <>
      <DetailSection title={t("fleet.tab.summary")}>
        <DescriptionGrid
          items={[
            { label: t("fleet.column.code"), value: motorcycle.code },
            { label: t("fleet.column.plate"), value: motorcycle.plate },
            { label: t("fleet.summary.createdAt"), value: format(motorcycle.created_at) },
            {
              label: t("fleet.summary.createdBy"),
              value: motorcycle.created_by ? (
                <EntityName kind="user" id={motorcycle.created_by} />
              ) : (
                t("fleet.summary.system")
              ),
            },
            ...voided,
          ]}
        />
      </DetailSection>
      <DetailSection title={t("fleet.summary.metrics")} hint={t("fleet.efficiency.detail")}>
        <MotorcycleMetricsSummary motorcycle={motorcycle} />
      </DetailSection>
    </>
  );
}
