import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { KIND_LABEL } from "./labels.ts";
const ENTRIES = [
  { kind: "replace", name: "ovitrapReplace" },
  { kind: "relocate", name: "ovitrapRelocate" },
  { kind: "remove", name: "ovitrapRemove" },
] as const;
export function LifecycleEntry({
  ovitrapId,
  manualCapture,
}: {
  readonly ovitrapId: string;
  readonly manualCapture: boolean;
}) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <View>
      {ENTRIES.map(({ kind, name }) => (
        <ShiftAction
          key={kind}
          label={t(KIND_LABEL[kind])}
          onPress={() => {
            push({ name, ovitrapId, manualCapture });
          }}
        />
      ))}
    </View>
  );
}
