import { View } from "react-native";
import { AppText } from "../../ui/AppText.tsx";
import { TextField } from "../../ui/TextField.tsx";
interface Props {
  readonly label: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}
export function ConditionField({ label, value, onChange, disabled }: Props) {
  return (
    <View>
      <AppText>{label}</AppText>
      <TextField
        editable={!disabled}
        accessibilityState={{ disabled }}
        label={label}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
      />
    </View>
  );
}
