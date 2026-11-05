import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import type { Check } from "./domain.ts";
import { ShiftAction } from "./ShiftAction.tsx";
import { createShiftStyles } from "./styles.ts";
interface Props {
  readonly check?: Check;
  readonly onSelect: (result: Check["result"]) => void;
}
export function CheckResults({ check, onSelect }: Props) {
  const t = useT();
  const styles = useStyles(createShiftStyles);
  return (
    <View style={styles.group}>
      {(["ok", "minor", "severe"] as const).map((result) => (
        <ShiftAction
          key={result}
          label={t(
            result === "severe" ? "mobile.shiftOpen.severeResult" : `mobile.shiftOpen.${result}`,
          )}
          selected={check?.result === result}
          onPress={() => {
            onSelect(result);
          }}
        />
      ))}
    </View>
  );
}
