import { View } from "react-native";
import { AppText } from "../../ui/AppText.tsx";

export function ReceiptReference({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <View>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText selectable isMonospace>
        {value}
      </AppText>
    </View>
  );
}
