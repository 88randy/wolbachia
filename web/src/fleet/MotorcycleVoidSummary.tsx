import { useTranslation } from "react-i18next";
import type { DescriptionItem } from "../components/templates/DescriptionGrid";
import { useFormatDateTime } from "../format/use-format-date-time";
import { nameOrDash } from "../lookups/use-reference-names";
import type { Motorcycle } from "./fleet-query";
import { useFleetAuthor } from "./use-fleet-author";

/** The void facts of a motorcycle as description items; empty when it is not voided. */
export function useVoidItems(motorcycle: Motorcycle): DescriptionItem[] {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const author = useFleetAuthor();
  if (motorcycle.voided_at === null) return [];
  return [
    { label: t("fleet.summary.voidedAt"), value: format(motorcycle.voided_at) },
    {
      label: t("fleet.summary.voidedBy"),
      value: motorcycle.voided_by === null ? author(null) : nameOrDash(motorcycle.voided_by_name),
    },
    { label: t("common.fields.voidReason"), value: motorcycle.void_reason, wide: true },
  ];
}
