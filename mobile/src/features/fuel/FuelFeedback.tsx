import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { createFuelStyles } from "./styles.ts";
import type { M11Model } from "./use-m-11.ts";

export function FuelFeedback({ model }: { readonly model: M11Model }) {
  const t = useT();
  const styles = useStyles(createFuelStyles);
  if (!model.errorKey) return null;
  return (
    <View style={styles.group}>
      <Notice tone="critical" icon="alert" message={t(model.errorKey)} />
      <Button
        variant="outline"
        label={t("common.actions.retry")}
        disabled={model.isBusy}
        onPress={() => {
          void model.run(model.refresh);
        }}
      />
    </View>
  );
}
