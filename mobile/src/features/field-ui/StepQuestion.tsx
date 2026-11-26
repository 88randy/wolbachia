import { View } from "react-native";
import { AppText } from "../../ui/AppText.tsx";

interface Props {
  readonly title: string;
  readonly hint?: string;
}

/** The one question of a wizard step, big, with a short helper line under it. */
export function StepQuestion({ title, hint }: Props) {
  return (
    <View className="gap-1">
      <AppText variant="h1" accessibilityRole="header">
        {title}
      </AppText>
      {hint ? (
        <AppText variant="body" tone="secondary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
