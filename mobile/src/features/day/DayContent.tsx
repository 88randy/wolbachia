import { DayBody } from "./DayBody.tsx";
import { DayRefreshStatus } from "./DayRefreshStatus.tsx";
import { ScrollView } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { createDayStyles } from "./styles.ts";
import type { M06Model } from "./use-m-06.ts";
import { DayNotices } from "./DayNotices.tsx";
import { LocationNotice } from "./LocationNotice.tsx";
export function DayContent({ model }: { readonly model: M06Model }) {
  const t = useT();
  const styles = useStyles(createDayStyles);
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <DayRefreshStatus model={model} />
      <DayNotices model={model} />
      {model.state === null ? null : <LocationNotice model={model} />}
      <DayBody model={model} />
      {model.phase === "empty" ? null : (
        <Button
          disabled={model.isRefreshing}
          label={t("mobile.day.refresh")}
          variant="outline"
          onPress={() => {
            void model.refresh();
          }}
        />
      )}
    </ScrollView>
  );
}
