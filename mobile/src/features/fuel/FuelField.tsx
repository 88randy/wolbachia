import { useState } from "react";
import { View } from "react-native";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { TextField } from "../../ui/TextField.tsx";
import { validateFuelField } from "./domain.ts";
import { FuelError } from "./domain.ts";
import { fuelErrorKey } from "./fuel-error-key.ts";
import { createFuelStyles } from "./styles.ts";

interface Props {
  readonly field: "litres" | "amount" | "odometer";
  readonly labelKey: MessageKey;
  readonly value: string;
  readonly disabled: boolean;
  readonly isSubmitted: boolean;
  readonly onChange: (value: string) => void;
}
/** Validate on blur, then on change; invalid raw input stays editable. */
export function FuelField(props: Props) {
  const t = useT();
  const styles = useStyles(createFuelStyles);
  const [hasBlurred, setBlurred] = useState(false);
  const code = hasBlurred || props.isSubmitted ? validateFuelField(props.field, props.value) : null;
  const errorKey = code === null ? null : fuelErrorKey(new FuelError(code));
  return (
    <View style={styles.group}>
      <AppText>{t(props.labelKey)}</AppText>
      <TextField
        label={t(props.labelKey)}
        value={props.value}
        onChangeText={props.onChange}
        keyboardType={props.field === "odometer" ? "number-pad" : "decimal-pad"}
        editable={!props.disabled}
        accessibilityState={{ disabled: props.disabled }}
        accessibilityHint={errorKey === null ? undefined : t(errorKey)}
        onBlur={() => {
          setBlurred(true);
        }}
      />
      {errorKey === null ? null : <AppText accessibilityLiveRegion="polite">{t(errorKey)}</AppText>}
    </View>
  );
}
