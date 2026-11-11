import { useTranslation } from "react-i18next";
import { DescriptionGrid } from "../components/templates/DescriptionGrid";
import { DetailSection } from "../components/templates/DetailSection";
import { useFormatDateTime } from "../format/use-format-date-time";
import type { MotorcycleDetail } from "./fleet-query";
import { MotorcycleMetricsSummary } from "./MotorcycleMetricsSummary";
import { useVoidItems } from "./MotorcycleVoidSummary";
import { useFleetAuthor } from "./use-fleet-author";

/** Two cards: who the motorcycle is, and its mileage and service. */
export function MotorcycleSummary({ motorcycle }: { motorcycle: MotorcycleDetail }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const author = useFleetAuthor();
  const voided = useVoidItems(motorcycle);
  return (
    <>
      <DetailSection title={t("fleet.summary.identity")}>
        <DescriptionGrid
          items={[
            { label: t("fleet.column.code"), value: motorcycle.code },
            { label: t("fleet.column.plate"), value: motorcycle.plate },
            { label: t("fleet.summary.createdAt"), value: format(motorcycle.created_at) },
            { label: t("fleet.summary.createdBy"), value: author(motorcycle.created_by) },
            ...voided,
          ]}
        />
      </DetailSection>
      <DetailSection title={t("fleet.summary.metrics")}>
        <MotorcycleMetricsSummary motorcycle={motorcycle} />
      </DetailSection>
    </>
  );
}
