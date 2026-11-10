import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { IncidentTypeSheet } from "./IncidentTypeSheet.tsx";
import { IncidentTypeSummary } from "./IncidentTypeSummary.tsx";
import { useTypePicker } from "./use-type-picker.ts";
import type { M12Model } from "./use-m-12.ts";
export function IncidentTypePicker({ model }: { readonly model: M12Model }) {
  const t = useT(),
    picker = useTypePicker(model),
    draft = model.state?.draft;
  if (!draft) return null;
  return (
    <View>
      <IncidentTypeSummary type={draft.type} />
      <Button
        variant="outline"
        label={t("mobile.incidents.chooseType")}
        disabled={picker.disabled}
        onPress={picker.open}
      />
      <IncidentTypeSheet {...picker} onQuery={picker.setQuery} />
    </View>
  );
}
