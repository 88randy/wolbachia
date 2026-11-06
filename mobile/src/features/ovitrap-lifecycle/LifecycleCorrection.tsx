import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { CatalogChoices } from "./CatalogChoices.tsx";
import { useLifecycleCorrection } from "./use-lifecycle-correction.ts";
import type { LifecycleProps } from "./model.ts";
export function LifecycleCorrection(props: LifecycleProps) {
  const { draft, model } = props;
  const t = useT();
  const correction = useLifecycleCorrection(props);
  if (correction.isBlocked) return null;
  return (
    <View>
      <CatalogChoices
        items={draft.catalog?.voidReasons ?? []}
        code={correction.reasonCode}
        isBusy={model.isBusy}
        choose={correction.setCode}
      />
      <ShiftField
        label={t("mobile.lifecycle.correctionReason")}
        value={correction.reason}
        disabled={model.isBusy}
        onChange={correction.setReason}
      />
      <ShiftAction
        label={t("mobile.lifecycle.correct")}
        disabled={correction.disabled}
        onPress={correction.correct}
      />
    </View>
  );
}
