import { View } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { SupplyEquation } from "./SupplyEquation.tsx";
import { ReturnField } from "./ReturnField.tsx";
import { ShrinkageField } from "./ShrinkageField.tsx";
import type { M14Model } from "./use-m-14.ts";
export function SuppliesForm({ model }: { readonly model: M14Model }) {
  const styles = useStyles(createShiftStyles);
  const t = useT(); const draft = model.state?.draft;
  if (!draft) return null;
  return <View style={styles.group}>
    <AppText variant="button">{t("mobile.shiftClose.supplies")}</AppText>
    <Notice tone="info" icon="phone" message={t("mobile.shiftClose.differenceAllowed")} />
    {!draft.supplies.length ? <Notice tone="warning" icon="alert" message={t("mobile.shiftClose.suppliesUnavailable")} /> : null}
    <Button label={t("mobile.shiftClose.refreshSupplies")} variant="outline" disabled={model.isBusy} onPress={() => { void model.run(() => model.service.refreshSupplies()); }} />
    <AppText>{t("mobile.shiftClose.sourceFrame")}</AppText>
    {draft.supplies.map((supply) => <View key={supply.eventId} style={styles.group}>
      <AppText variant="mono">{supply.source.id}</AppText>
      {supply.source.frame.map((line) => <SupplyEquation key={line.assignment_line_id} line={line} />)}
      {(model.state?.canReconcile ? supply.source.receipts : []).filter((receipt) => !receipt.voided).flatMap((receipt) => receipt.lines.map((line) => <View key={line.id} style={styles.group}>
        <ReturnField supply={supply} lineId={line.id} sourceId={receipt.source_event_id} disabled={model.isBusy} onChange={(next) => { model.edit({ supplies: draft.supplies.map((item) => item.eventId === next.eventId ? next : item) }); }} />
        <ShrinkageField model={model} supply={supply} lineId={line.id} sourceId={receipt.source_event_id} />
      </View>))}
    </View>)}
  </View>;
}
