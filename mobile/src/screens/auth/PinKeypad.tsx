import { spacing } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { PinKey } from "./PinKey.tsx";
import { PIN_KEY_ROWS } from "./pin-keypad-model.ts";
import type { PinKeypadProps } from "./pin-keypad-model.ts";

const styles = StyleSheet.create({
  pad: { gap: spacing[1] },
  row: { flexDirection: "row", gap: spacing[1] },
});

export function PinKeypad(props: PinKeypadProps) {
  return (
    <View style={styles.pad}>
      {PIN_KEY_ROWS.map((row, index) => (
        <View style={styles.row} key={index}>
          {row.map((value) => (
            <PinKey key={value} value={value} actions={props} />
          ))}
        </View>
      ))}
    </View>
  );
}
