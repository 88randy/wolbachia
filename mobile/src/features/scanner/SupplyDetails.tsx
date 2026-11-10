import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ReceiptReference } from "../supply-receipt/ReceiptReference.tsx";
import type { ScannerResource } from "./resource-source.ts";

/** Display downloaded plan pins without inferring receipt, available stock or expiry. */
export function SupplyDetails({ resource }: { readonly resource: ScannerResource }) {
  const t = useT();
  const supply = resource.supply;
  if (!supply)
    return <Notice tone="warning" icon="alert" message={t("mobile.scanner.unavailable")} />;
  const fields = [
    ["mobile.scanner.lot", resource.id],
    ["mobile.scanner.quantity", supply.expected],
    ["mobile.scanner.unit", supply.unitId],
    ["mobile.scanner.assignment", supply.assignmentId],
    ["mobile.scanner.date", supply.date],
    ["mobile.scanner.revision", String(supply.revision)],
    ["mobile.scanner.sourceLine", supply.lineId],
  ] as const;
  return (
    <Card>
      <AppText variant="button" accessibilityRole="header">
        {t("mobile.scanner.supplyTitle")}
      </AppText>
      {fields.map(([key, value]) => (
        <ReceiptReference key={key} label={t(key)} value={value} />
      ))}
      <Notice tone="info" icon="phone" message={t("mobile.scanner.missingMetadata")} />
    </Card>
  );
}
