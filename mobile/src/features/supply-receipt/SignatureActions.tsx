import { Check, Eraser } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";

interface Props {
  readonly canClear: boolean;
  readonly canKeep: boolean;
  readonly onClear: () => void;
  readonly onKeep: () => void;
}

/** "Borrar" undoes the last stroke; "Guardar firma" keeps the drawing. */
export function SignatureActions({ canClear, canKeep, onClear, onKeep }: Props) {
  const t = useT();
  return (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <SecondaryButton
          icon={Eraser}
          label={t("field.receipt.signClear")}
          disabled={!canClear}
          onPress={onClear}
        />
      </View>
      <View className="flex-1">
        <SecondaryButton
          icon={Check}
          label={t("field.receipt.signKeep")}
          disabled={!canKeep}
          onPress={onKeep}
        />
      </View>
    </View>
  );
}
