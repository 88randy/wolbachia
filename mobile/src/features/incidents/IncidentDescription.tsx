import { useState } from "react";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { TextField } from "../../ui/TextField.tsx";
import { MAX_INCIDENT_DESCRIPTION } from "./domain.ts";

interface Props {
  readonly value: string;
  readonly isRequired: boolean;
  readonly isSubmitted: boolean;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}
/** Required report details validate on blur/submit, retaining the original text on failure. */
export function IncidentDescription(props: Props) {
  const t = useT();
  const [hasBlurred, setBlurred] = useState(false);
  const hasError = (hasBlurred || props.isSubmitted) && props.isRequired && !props.value.trim();
  const label = t(
    props.isRequired ? "mobile.incidents.description" : "mobile.incidents.optionalDescription",
  );
  return (
    <View>
      <AppText>{label}</AppText>
      <TextField
        label={label}
        value={props.value}
        onChangeText={props.onChange}
        editable={!props.disabled}
        multiline
        maxLength={MAX_INCIDENT_DESCRIPTION}
        accessibilityHint={hasError ? t("mobile.incidents.descriptionRequired") : undefined}
        onBlur={() => {
          setBlurred(true);
        }}
      />
      {hasError ? (
        <AppText accessibilityLiveRegion="polite">
          {t("mobile.incidents.descriptionRequired")}
        </AppText>
      ) : null}
    </View>
  );
}
