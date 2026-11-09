import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import type { ReconcileDraft } from "./domain.ts";

export function ClosedSupplyReturns({ supply }: { readonly supply: ReconcileDraft }) {
  const t = useT();
  return (
    <>
      {supply.returns.map((line) => (
        <Card key={line.receiptLineId}>
          <AppText>{t("mobile.shiftClose.returnQuantity")}</AppText>
          <AppText variant="bodyStrong">{line.returned}</AppText>
        </Card>
      ))}
    </>
  );
}
