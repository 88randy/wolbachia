import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import type { ReconcileDraft } from "./domain.ts";

export function ClosedSupplyShrinkage({ supply }: { readonly supply: ReconcileDraft }) {
  const t = useT();
  return (
    <>
      {supply.shrinkage?.map((line) => (
        <Card key={line.receiptLineId}>
          <AppText>{t("mobile.shiftClose.shrinkageQuantity")}</AppText>
          <AppText variant="bodyStrong">{line.quantity}</AppText>
          <AppText>{line.reason}</AppText>
        </Card>
      ))}
    </>
  );
}
