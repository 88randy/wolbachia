import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { CatalogChoices } from "../ovitrap-lifecycle/CatalogChoices.tsx";
import type { ReconcileDraft } from "./domain.ts";
import type { M14Model } from "./use-m-14.ts";
interface Props { readonly model: M14Model; readonly supply: ReconcileDraft; readonly lineId: string; readonly sourceId: string; }
export function ShrinkageField({ model, supply, lineId, sourceId }: Props) {
  const t = useT();
  const line = supply.shrinkage?.find((line) => line.receiptLineId === lineId) ?? { receiptLineId: lineId, receiptSourceEventId: sourceId, quantity: "", reasonCode: "", reason: "" };
  const edit = (patch: Partial<typeof line>) => {
    const next = { ...supply, shrinkage: [...(supply.shrinkage ?? []).filter((item) => item.receiptLineId !== lineId), { ...line, ...patch }] };
    model.edit({ supplies: model.state?.draft?.supplies.map((item) => item.eventId === supply.eventId ? next : item) ?? [] });
  };
  return <Card>
    <ShiftField label={t("mobile.shiftClose.shrinkageQuantity")} value={line.quantity} decimal disabled={model.isBusy} onChange={(quantity) => { edit({ quantity }); }} />
    {line.quantity && Number(line.quantity) !== 0 ? <>
      <CatalogChoices items={model.state?.reasons ?? []} code={line.reasonCode} isBusy={model.isBusy} choose={(reasonCode) => { edit({ reasonCode }); }} />
      <ShiftField label={t("mobile.shiftClose.reason")} value={line.reason} disabled={model.isBusy} onChange={(reason) => { edit({ reason }); }} />
      <Button label={t("mobile.shiftClose.photo")} disabled={model.isBusy} onPress={() => { model.capturePhoto(supply.eventId); }} />
      {supply.photos?.length ? <AppText>{t("mobile.shiftClose.photoSaved")}</AppText> : <AppText>{t("mobile.shiftClose.photoRequired")}</AppText>}
    </> : null}
  </Card>;
}
