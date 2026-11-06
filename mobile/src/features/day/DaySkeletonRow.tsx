import { View } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { Card } from "../../ui/Card.tsx";
import { createDayStyles } from "./styles.ts";

export function DaySkeletonRow() {
  const styles = useStyles(createDayStyles);
  return (
    <Card>
      <View style={styles.skeletonCode} />
      <View style={styles.skeletonLine} />
      <View style={styles.skeletonBadge} />
    </Card>
  );
}
