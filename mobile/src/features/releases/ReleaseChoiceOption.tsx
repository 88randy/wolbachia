import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { Pressable, StyleSheet } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Badge } from "../../ui/Badge.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    choice: {
      minHeight: spacing[6],
      justifyContent: "center",
      padding: spacing[1.5],
      gap: spacing[1],
      borderWidth: 2,
      borderRadius: radius.inner,
      borderColor: theme.color.border.default,
    },
    selected: { borderColor: theme.color.actionStrong, backgroundColor: theme.color.tint },
  });
interface Props {
  readonly option: { readonly id: string; readonly code: string };
  readonly isSelected: boolean;
  readonly disabled: boolean;
  readonly onSelect: (id: string) => void;
}
export function ReleaseChoiceOption(props: Props) {
  const t = useT();
  const styles = useStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={props.option.code}
      accessibilityState={{ checked: props.isSelected, disabled: props.disabled }}
      disabled={props.disabled}
      onPress={() => {
        props.onSelect(props.option.id);
      }}
      style={[styles.choice, props.isSelected ? styles.selected : null]}
    >
      <AppText variant="bodyStrong">{props.option.code}</AppText>
      {props.isSelected ? (
        <Badge tone="info" icon="check" label={t("mobile.release.selectedChoice")} />
      ) : null}
    </Pressable>
  );
}
