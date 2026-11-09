import { View } from "react-native";
import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createShiftStyles } from "../shift-open/styles.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { CloseFooter } from "./CloseFooter.tsx";
import { CloseOdometerForm } from "./CloseOdometerForm.tsx";
import { PendingPoints } from "./PendingPoints.tsx";
import { SuppliesForm } from "./SuppliesForm.tsx";
import type { M14Model } from "./use-m-14.ts";

export function P26Screen({ model }: { readonly model: M14Model }) {
  const styles = useStyles(createShiftStyles);
  const t = useT();
  if (!model.state?.draft) return <AppText>{t("mobile.shiftClose.noShift")}</AppText>;
  return (
    <View style={styles.root}>
      <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PendingPoints model={model} />
        <SuppliesForm model={model} />
        <CloseOdometerForm model={model} />
      </AppScrollView>
      <CloseFooter model={model} />
    </View>
  );
}
