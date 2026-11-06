import { hasCoordinates } from "./assignment-parser.ts";
import { Pressable, View } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Card } from "../../ui/Card.tsx";
import { AppText } from "../../ui/AppText.tsx";
import type { DayTask } from "./domain.ts";
import { TaskSummary } from "./TaskSummary.tsx";
import { createDayStyles } from "./styles.ts";
export function TaskCard({
  row,
  onSelect,
  isCovered,
}: {
  readonly row: DayTask;
  readonly onSelect: () => void;
  readonly isCovered: boolean;
}) {
  const styles = useStyles(createDayStyles);
  const t = useT();
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={row.task.point_code}
        onPress={onSelect}
        style={styles.card}
      >
        <View style={styles.group}>
          <TaskSummary row={row} />
          {hasCoordinates(row.task) ? null : <AppText>{t("mobile.day.noLocation")}</AppText>}
          {isCovered ? null : <AppText>{t("mobile.day.outsideCoverage")}</AppText>}
        </View>
      </Pressable>
    </Card>
  );
}
