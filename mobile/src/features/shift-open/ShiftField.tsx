import { View } from "react-native";
import { AppText } from "../../ui/AppText.tsx";
import { TextField } from "../../ui/TextField.tsx";
interface Props {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly numeric?: boolean;
}
export function ShiftField({ label, value, onChange, numeric = false }: Props) {
  return (
    <View>
      <AppText>{label}</AppText>
      <TextField
        label={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "number-pad" : "default"}
        accessibilityState={{ disabled: false }}
      />
    </View>
  );
}
