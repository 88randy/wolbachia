import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppFlatList } from "../../ui/AppFlatList.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { HistoryCard } from "./HistoryCard.tsx";
import { HistoryGroupCard } from "./HistoryGroupCard.tsx";
import { HistoryHeader } from "./HistoryHeader.tsx";
import { HistoryEmpty } from "./HistoryEmpty.tsx";
import { createHistoryStyles } from "./styles.ts";
import { useHistory } from "./use-history.ts";

export function P29Screen() {
  const model = useHistory(),
    t = useT(),
    styles = useStyles(createHistoryStyles);
  return (
    <View style={styles.root}>
      <ScreenHeader largeTargets title={t("mobile.history.title")} />
      <AppFlatList
        data={model.rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
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
