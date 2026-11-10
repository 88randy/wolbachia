import { RotateCw } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppFlatList } from "../../ui/AppFlatList.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { TrainingHeader } from "./TrainingHeader.tsx";
import { TrainingRow } from "./TrainingRow.tsx";
import { trainingRows } from "./presentation.ts";
import { useTraining } from "./use-training.ts";

/** P30 reads locally first. Only the explicit refresh action uses the authenticated API. */
export function P30Screen() {
  const model = useTraining();
  const t = useT();
  return (
    <View className="flex-1 bg-bg">
      <AppHeader title={t("trainings.mobile.title")} />
      <AppFlatList
        data={trainingRows(model.source)}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerClassName="gap-3 p-4 pb-8"
        ListHeaderComponent={<TrainingHeader model={model} />}
        renderItem={({ item }) => (
          <TrainingRow item={item} now={model.now} timeZone={model.timeZone} />
        )}
      />
      <View className="border-t border-line bg-surface p-4">
        <SecondaryButton
          icon={RotateCw}
          label={t("trainings.mobile.refresh")}
          isLoading={model.isRefreshing}
          onPress={() => {
            void model.refresh();
          }}
        />
      </View>
    </View>
  );
}
