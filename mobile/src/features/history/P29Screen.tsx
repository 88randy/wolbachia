import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppFlatList } from "../../ui/AppFlatList.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { HistoryCard } from "./HistoryCard.tsx";
import { HistoryEmpty } from "./HistoryEmpty.tsx";
import { HistoryGroupCard } from "./HistoryGroupCard.tsx";
import { HistoryHeader } from "./HistoryHeader.tsx";
import { useHistory } from "./use-history.ts";

/** P29: what I did, grouped by day; tap a day to see its entries. */
export function P29Screen() {
  const model = useHistory();
  const t = useT();
  return (
    <View className="flex-1 bg-bg">
      <AppHeader title={t("mobile.history.title")} />
      <AppFlatList
        data={model.rows}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerClassName="gap-3 p-4 pb-8"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<HistoryHeader model={model} />}
        ListEmptyComponent={<HistoryEmpty model={model} />}
        renderItem={({ item }) =>
          "entries" in item ? (
            <HistoryGroupCard group={item} select={model.selectGroup} />
          ) : (
            <HistoryCard entry={item} formattedTime={model.formatTime(item.time)} />
          )
        }
      />
    </View>
  );
}
