import { View } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { SupplyReconciliationForm } from "./SupplyReconciliationForm.tsx";
import type { M14Model } from "./use-m-14.ts";
export function SuppliesForm({ model }: { readonly model: M14Model }) {
  const styles = useStyles(createShiftStyles);
  const t = useT();
  const draft = model.state?.draft;
  if (!draft) return null;
  const refresh = () => {
    void model.run(() => model.service.refreshSupplies());
  };
  return (
    <View style={styles.group}>
      <AppText variant="button">{t("mobile.shiftClose.supplies")}</AppText>
      <Notice tone="info" icon="phone" message={t("mobile.shiftClose.differenceAllowed")} />
      {!draft.supplies.length ? (
        <Notice tone="warning" icon="alert" message={t("mobile.shiftClose.suppliesUnavailable")} />
      ) : null}
      <Button
        label={t("mobile.shiftClose.refreshSupplies")}
        variant="outline"
        disabled={model.isBusy}
        onPress={refresh}
      />
      <AppText>{t("mobile.shiftClose.sourceFrame")}</AppText>
      {draft.supplies.map((supply) => (
        <SupplyReconciliationForm key={supply.eventId} model={model} supply={supply} />
      ))}
    </View>
  );
}
