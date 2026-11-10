import { View } from "react-native";
import { AppFlatList } from "../../ui/AppFlatList.tsx";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@wolbachia/tokens";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { Button } from "../../ui/Button.tsx";
import { TrainingRow } from "./TrainingRow.tsx";
import { TrainingHeader } from "./TrainingHeader.tsx";
import { trainingRows } from "./presentation.ts";
import { useTraining } from "./use-training.ts";
import { createTrainingStyles } from "./styles.ts";

/** P30 reads locally first. Only the explicit refresh action uses the authenticated API. */
export function P30Screen() {
  const model = useTraining(),
    t = useT(),
    styles = useStyles(createTrainingStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScreenHeader largeTargets title={t("trainings.mobile.title")} />
      <AppFlatList
        data={trainingRows(model.source)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<TrainingHeader model={model} />}
        renderItem={({ item }) => (
          <TrainingRow item={item} now={model.now} timeZone={model.timeZone} />
        )}
      />
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[2] }]}>
        <Button
          variant="outline"
          label={t("trainings.mobile.refresh")}
          disabled={model.isRefreshing}
          onPress={() => {
            void model.refresh();
          }}
        />
      </View>
    </View>
  );
}
