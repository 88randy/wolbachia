import { View } from "react-native";
import { useLocale } from "../../i18n/I18nProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { catalogLabel } from "../ovitrap-check/labels.ts";
import type { ChecklistItem } from "../shift-open/domain.ts";
export interface CatalogProps {
  readonly items: readonly ChecklistItem[];
  readonly code: string;
  readonly choose: (code: string) => void;
}
export function CatalogOptions({ items, code, choose }: CatalogProps) {
  const locale = useLocale();
  return (
    <View>
      {items.map((item) => (
        <ShiftAction
          key={item.code}
          label={catalogLabel(item, locale)}
          selected={code === item.code}
          onPress={() => {
            choose(item.code);
          }}
        />
      ))}
    </View>
  );
}
