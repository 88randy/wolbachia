import { Bike } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import type { MotorcycleOption } from "./domain.ts";

interface Props {
  readonly options: readonly MotorcycleOption[];
  readonly selectedCode: string;
  readonly onSelect: (option: MotorcycleOption) => void;
}

/** The fleet as big tappable rows; a blocked motorcycle is shown but cannot be chosen. */
export function MotorcycleList({ options, selectedCode, onSelect }: Props) {
  const t = useT();
  return (
    <View accessibilityRole="radiogroup" className="gap-3">
      {options.map((option) => (
        <ChoiceRow
          key={option.code}
          icon={Bike}
          label={option.code}
          hint={option.isBlocked ? t("field.open.motorcycleBlocked") : option.plate || undefined}
          isSelected={option.code === selectedCode}
          disabled={option.isBlocked}
          onPress={() => {
            onSelect(option);
          }}
        />
      ))}
    </View>
  );
}
