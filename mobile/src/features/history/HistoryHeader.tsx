import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { TextField } from "../../ui/TextField.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { Button } from "../../ui/Button.tsx";
import { createHistoryStyles } from "./styles.ts";
import type { useHistory } from "./use-history.ts";

export function HistoryHeader({ model }: { readonly model: ReturnType<typeof useHistory> }) {
  const t = useT(),
    styles = useStyles(createHistoryStyles);
  return (
    <View style={styles.section}>
      <AppText>{t("mobile.history.search")}</AppText>
      <TextField
        label={t("mobile.history.search")}
        value={model.search}
        onChangeText={model.setSearch}
        autoCapitalize="none"
      />
      <Notice tone="info" icon="search" message={t("mobile.history.partial")} />
      {model.hasError ? (
        <Notice tone="warning" icon="alert" message={t("mobile.history.failed")} />
      ) : null}
      <Button
        variant="outline"
        label={t("mobile.history.refresh")}
        onPress={() => {
          void model.refresh();
        }}
      />
      {model.isSelected ? (
        <Button variant="text" label={t("mobile.history.allShifts")} onPress={model.backToGroups} />
      ) : null}
    </View>
  );
}
