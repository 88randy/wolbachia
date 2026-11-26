import { Check } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { kitShadow, KIT_ICON_STROKE } from "../../ui/kit-styles.ts";

export interface PreferenceOption {
  readonly id: string;
  readonly label: string;
}

interface Props {
  readonly title: string;
  readonly options: readonly PreferenceOption[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
}

function Option({
  option,
  isSelected,
  onSelect,
}: {
  readonly option: PreferenceOption;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const { theme } = useTheme();
  const color = isSelected ? theme.color.onAction : theme.color.text.primary;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={option.label}
      onPress={() => {
        onSelect(option.id);
      }}
      className={`min-h-14 min-w-[30%] flex-1 flex-row items-center justify-center gap-2 rounded-2xl border-2 px-3 py-2 ${isSelected ? "border-action bg-action" : "border-line bg-surface"}`}
    >
      {isSelected ? <Check color={color} size={20} strokeWidth={KIT_ICON_STROKE} /> : null}
      <AppText variant="bodyStrong" className="text-center" style={{ color }}>
        {option.label}
      </AppText>
    </Pressable>
  );
}

/** A setting with two or three big choices, the chosen one filled. */
export function PreferenceChoices({ title, options, selectedId, onSelect }: Props) {
  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4" style={kitShadow.card}>
      <AppText variant="bodyStrong">{title}</AppText>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <Option
            key={option.id}
            option={option}
            isSelected={option.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}
