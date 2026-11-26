import { useTranslation } from "react-i18next";
import { DescriptionGrid } from "../../../components/templates/DescriptionGrid";
import type { DescriptionItem } from "../../../components/templates/DescriptionGrid";
import { DetailSection } from "../../../components/templates/DetailSection";
import { useFormatDateTime } from "../../../format/use-format-date-time";
import { EmptyValue } from "../../../ui/EmptyValue";
import type { CenterRow } from "./centers-api";
import { CenterStatusPill } from "./CenterStatusPill";

/** When, who and why, for an inactive center; nothing for an active one. */
function useDeactivationItems(center: CenterRow): DescriptionItem[] {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  if (!center.deactivated_at) return [];
  return [
    { label: t("centersAdmin.detail.deactivatedAt"), value: formatDateTime(center.deactivated_at) },
    {
      label: t("centersAdmin.detail.deactivatedBy"),
      value: center.deactivated_by_name ?? <EmptyValue />,
    },
    {
      label: t("centersAdmin.detail.deactivatedReason"),
      value: center.deactivated_reason,
      wide: true,
    },
  ];
}

/** The data card: name, code, status, dates and, for an inactive center, who closed it and why. */
export function CenterFacts({ center }: { center: CenterRow }) {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  const deactivation = useDeactivationItems(center);
  const items: DescriptionItem[] = [
    { label: t("centersAdmin.form.name"), value: center.name },
    { label: t("centersAdmin.form.code"), value: center.code },
    {
      label: t("centersAdmin.col.status"),
      value: <CenterStatusPill isActive={center.is_active} />,
    },
    { label: t("centersAdmin.detail.created"), value: formatDateTime(center.created_at) },
    { label: t("centersAdmin.col.updated"), value: formatDateTime(center.updated_at) },
    ...deactivation,
  ];
  return (
    <DetailSection title={t("centersAdmin.detail.data")}>
      <DescriptionGrid columns={3} items={items} />
    </DetailSection>
  );
}
