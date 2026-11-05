import { View } from "react-native";
import { AppText } from "../../ui/AppText.tsx";
import { TextField } from "../../ui/TextField.tsx";
interface Props {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}
export function ConditionField({ label, value, onChange }: Props) {
  return (
    <View>
      <AppText>{label}</AppText>
      <TextField label={label} value={value} onChangeText={onChange} keyboardType="decimal-pad" />
    </View>
  );
}
