import { ScrollView, View } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { useState } from "react";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { PendingPoints } from "./PendingPoints.tsx";
import { SuppliesForm } from "./SuppliesForm.tsx";
import type { M14Model } from "./use-m-14.ts";
export function P26Screen({ model }: { readonly model: M14Model }) {
  const styles = useStyles(createShiftStyles);
  const t = useT(); const [isConfirming, setConfirming] = useState(false);
  const draft = model.state?.draft;
  if (!draft) return <AppText>{t("mobile.shiftClose.noShift")}</AppText>;
  const opening = model.state?.opening?.envelope.payload as { odometer_km?: number } | undefined;
  const isLow = Number(draft.odometer) < (opening?.odometer_km ?? 0);
  return <View style={styles.root}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <PendingPoints model={model} /><SuppliesForm model={model} />
    <Card>
      <ShiftField label={t("mobile.shiftClose.odometer")} value={draft.odometer} numeric disabled={model.isBusy} onChange={(odometer) => { model.edit({ odometer }); }} />
      {isLow ? <Notice tone="warning" icon="alert" message={t("mobile.shiftClose.lowOdometer")} /> : null}
      <ShiftField label={t("mobile.shiftClose.note")} value={draft.note} disabled={model.isBusy} onChange={(note) => { model.edit({ note }); }} />
    </Card>
    </ScrollView><View style={styles.footer}>
    {isConfirming ? <Card>
      <AppText variant="button">{t("mobile.shiftClose.confirmTitle")}</AppText>
      <AppText>{t("mobile.shiftClose.confirmHint")}</AppText>
      <Button label={t("common.actions.cancel")} variant="text" disabled={model.isBusy} onPress={() => { setConfirming(false); }} />
      <Button label={t("mobile.shiftClose.close")} disabled={model.isBusy} onPress={() => { void model.run(() => model.service.close()); }} />
    </Card> : <Button label={t("mobile.shiftClose.continue")} disabled={model.isBusy} onPress={() => { setConfirming(true); }} />}
  </View></View>;
}
