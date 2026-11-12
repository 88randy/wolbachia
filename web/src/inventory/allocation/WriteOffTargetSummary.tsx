import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { DescriptionGrid } from "../../components/templates/DescriptionGrid";
import type { DescriptionItem } from "../../components/templates/DescriptionGrid";
import { useLanguage } from "../../i18n/use-language";
import { EntityName } from "../../lookups/EntityName";
import { formatInventoryQuantity } from "../format-inventory-quantity";
import type { WriteOffForm } from "./use-write-off-form";
import type { WriteOffTarget } from "./write-off-draft";

function lotItems(
  target: Extract<WriteOffTarget, { kind: "lot" }>,
  form: WriteOffForm,
  t: TFunction,
  locale: "es-MX" | "en",
): DescriptionItem[] {
  const { lot } = target;
  const place = form.locations.find((location) => location.id === target.locationId);
  const unit = lot.supply_version.unit === "piece" ? "" : ` ${lot.supply_version.unit}`;
  return [
    { label: t("allocation.writeOff.summary.supply"), value: lot.supply_version.label },
    { label: t("allocation.writeOff.kindLot"), value: lot.code },
    {
      label: t("allocation.writeOff.summary.center"),
      value: <EntityName kind="center" id={lot.center} />,
    },
    { label: t("allocation.writeOff.summary.location"), value: place?.name ?? null },
    {
      label: t("allocation.writeOff.summary.lotQuantity"),
      value:
        lot.quantity === null ? null : `${formatInventoryQuantity(lot.quantity, locale)}${unit}`,
    },
  ];
}

/** What the scanned code found, so the person only checks it, picks the reason and confirms. */
export function WriteOffTargetSummary({ form }: { form: WriteOffForm }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { target } = form;
  if (!target) return null;
  const items: DescriptionItem[] =
    target.kind === "lot"
      ? lotItems(target, form, t, language)
      : [
          { label: t("allocation.writeOff.kindBag"), value: target.bag.code },
          {
            label: t("allocation.writeOff.summary.lotQuantity"),
            value: t("allocation.writeOff.summary.wholeBag"),
          },
        ];
  return (
    <div className="rounded-xl border border-line bg-surface-muted p-4">
      <DescriptionGrid items={items} columns={3} />
    </div>
  );
}
