import { Pressable } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Badge } from "../../ui/Badge.tsx";
import { createSampleStyles } from "./styles.ts";
import type { SampleChoice as Choice } from "./view-model.ts";

interface Props {
  readonly option: Choice;
  readonly isSelected: boolean;
  readonly disabled: boolean;
  readonly onSelect: (id: string) => void;
}
export function SampleChoice({ option, isSelected, disabled, onSelect }: Props) {
  const t = useT();
  const styles = useStyles(createSampleStyles);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.label}
      accessibilityState={{ checked: isSelected, disabled }}
      disabled={disabled}
      onPress={() => {
        onSelect(option.id);
      }}
      style={[styles.choice, isSelected ? styles.selected : null]}
    >
      <AppText variant="bodyStrong">{option.label}</AppText>
      {isSelected ? <Badge tone="info" icon="check" label={t("mobile.sample.selected")} /> : null}
    </Pressable>
  );
}
