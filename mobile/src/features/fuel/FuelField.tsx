import { useState } from "react";
import { View } from "react-native";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { TextField } from "../../ui/TextField.tsx";
import { validateFuelField } from "./domain.ts";
import { FuelError } from "./domain.ts";
import { fuelErrorKey } from "./fuel-error-key.ts";

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
  const [hasBlurred, setBlurred] = useState(false);
  const code = hasBlurred || props.isSubmitted ? validateFuelField(props.field, props.value) : null;
  const errorKey = code === null ? null : fuelErrorKey(new FuelError(code));
  return (
    <View className="gap-1">
      <AppText variant="bodyStrong">{t(props.labelKey)}</AppText>
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
      {errorKey === null ? null : (
        <InfoNotice tone="danger" message={t(errorKey)} />
      )}
    </View>
  );
}
