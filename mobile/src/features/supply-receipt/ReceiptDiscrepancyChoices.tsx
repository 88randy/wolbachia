import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
type Kind = "missing" | "damaged" | "other";
const KINDS = ["missing", "damaged", "other"] as const;

export function ReceiptDiscrepancyChoices({
  selected,
  disabled,
  onChange,
}: {
  readonly selected: Kind | undefined;
  readonly disabled: boolean;
  readonly onChange: (kind: Kind) => void;
}) {
  const t = useT();
  return (
    <View>
      {KINDS.map((kind) => (
        <ShiftAction
          key={kind}
          label={t(`mobile.supplyReceipt.${kind}`)}
          disabled={disabled}
          selected={selected === kind}
          onPress={() => {
            onChange(kind);
          }}
        />
      ))}
    </View>
  );
}
