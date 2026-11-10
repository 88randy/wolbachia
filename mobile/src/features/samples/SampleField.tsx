import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { TextField } from "../../ui/TextField.tsx";

interface Props {
  readonly labelKey: MessageKey;
  readonly hintKey: MessageKey;
  readonly errorKey: MessageKey | null;
  readonly value: string;
  readonly disabled: boolean;
  readonly multiline?: boolean;
  readonly onChange: (value: string) => void;
  readonly onBlur: () => void;
}
export function SampleField(props: Props) {
  const t = useT();
  const hint = t(props.errorKey ?? props.hintKey);
  return (
    <>
      <AppText>{t(props.labelKey)}</AppText>
      <TextField
        label={t(props.labelKey)}
        value={props.value}
        editable={!props.disabled}
        multiline={props.multiline}
        onChangeText={props.onChange}
        onBlur={props.onBlur}
        accessibilityState={{ disabled: props.disabled }}
        accessibilityHint={hint}
      />
      <AppText variant="caption" accessibilityLiveRegion="polite">
        {hint}
      </AppText>
    </>
  );
}
