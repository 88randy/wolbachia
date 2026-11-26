import { Check, Circle } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { KIT_ICON_STROKE } from "../../ui/kit-styles.ts";

export interface ChoiceOption {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
}

interface Props {
  readonly options: readonly ChoiceOption[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly emptyLabel: string;
  readonly disabled: boolean;
}

function Row({
  option,
  isSelected,
  disabled,
  onSelect,
}: {
  readonly option: ChoiceOption;
  readonly isSelected: boolean;
  readonly disabled: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const { theme } = useTheme();
  const Icon = isSelected ? Check : Circle;
  const color = isSelected ? theme.color.onAction : theme.color.text.tertiary;
  const textColor = isSelected ? theme.color.onAction : undefined;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.hint ? `${option.label}. ${option.hint}` : option.label}
      accessibilityState={{ checked: isSelected, disabled }}
      disabled={disabled}
      onPress={() => {
        onSelect(option.id);
      }}
      className={`min-h-14 flex-row items-center gap-3 rounded-2xl border-2 px-4 py-3 ${isSelected ? "border-action bg-action" : "border-line bg-surface"}`}
    >
      <Icon color={color} size={24} strokeWidth={KIT_ICON_STROKE} />
      <View className="flex-1">
        <AppText variant="bodyStrong" style={{ color: textColor }}>
          {option.label}
        </AppText>
        {option.hint ? (
          <AppText variant="caption" tone="secondary" style={{ color: textColor }}>
            {option.hint}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Pick one from a short list; the chosen row is filled and shows a check. */
export function CommunityChoiceList({
  options,
  selectedId,
  onSelect,
  emptyLabel,
  disabled,
}: Props) {
  if (options.length === 0)
    return (
      <AppText variant="body" tone="secondary">
        {emptyLabel}
      </AppText>
    );
  return (
    <View className="gap-2">
      {options.map((option) => (
        <Row
          key={option.id}
          option={option}
          isSelected={option.id === selectedId}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}
