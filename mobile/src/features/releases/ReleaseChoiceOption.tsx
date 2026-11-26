import { Check, Circle } from "lucide-react-native";
import { Pressable } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { KIT_ICON_STROKE } from "../../ui/kit-styles.ts";

interface Props {
  readonly option: { readonly id: string; readonly code: string };
  readonly isSelected: boolean;
  readonly disabled: boolean;
  readonly onSelect: (id: string) => void;
}
export function ReleaseChoiceOption(props: Props) {
  const t = useT();
  const { theme } = useTheme();
  const Icon = props.isSelected ? Check : Circle;
  const frame = props.isSelected ? "border-action bg-action" : "border-line bg-surface";
  const color = props.isSelected ? theme.color.onAction : theme.color.text.tertiary;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={props.option.code}
      accessibilityState={{ checked: props.isSelected, disabled: props.disabled }}
      disabled={props.disabled}
      onPress={() => {
        props.onSelect(props.option.id);
      }}
      className={`min-h-14 flex-row items-center gap-3 rounded-2xl border-2 px-4 py-3 ${frame}`}
    >
      <Icon color={color} size={24} strokeWidth={KIT_ICON_STROKE} />
      <AppText variant="bodyStrong" style={{ color }}>
        {props.option.code}
      </AppText>
      {props.isSelected ? (
        <AppText variant="caption" style={{ color }}>
          {t("courier.choice.selected")}
        </AppText>
      ) : null}
    </Pressable>
  );
}
